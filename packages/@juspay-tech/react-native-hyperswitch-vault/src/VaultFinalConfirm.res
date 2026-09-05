type nextActionType = VaultNavigation.nextActionType
type safeThreeDs = VaultNavigation.safeThreeDs
type safeDdc = VaultNavigation.safeDdc
type safeSessionToken = VaultNavigation.safeSessionToken

type finalFailureReason =
  | GenericFailure
  | Unauthorized
  | Rejected
  | SessionAlreadyUsed
  | SessionExpired
  | MalformedResponse

type navOutcome =
  | Succeeded
  | Processing
  | RequiresAction({
      type_: nextActionType,
      redirectUrl: option<string>,
      threeDs: option<safeThreeDs>,
      ddc: option<safeDdc>,
      sessionToken: option<safeSessionToken>,
    })
  | Failed({reason: finalFailureReason})
  | UnknownOutcome

type finalConfirmRequest = {
  baseUrl: string,
  paymentId: string,

  credential: VaultCredential.t,

  appId?: string,

  body: JSON.t,
  timeoutMs?: int,
  signal?: VaultConfirm.abortSignal,
}

let reasonForCode = (code: string) =>
  switch code {
  | "IR_00" | "IR_01" | "IR_03" => Unauthorized
  | "IR_05" | "IR_06" => Rejected
  | "IR_16" => SessionAlreadyUsed
  | "IR_24" => SessionExpired
  | _ => GenericFailure
  }

let stringAt = (dict, key) =>
  dict->Dict.get(key)->Option.flatMap(JSON.Decode.string)->Option.getOr("")

let optionalStringAt = (dict, key) =>
  dict
  ->Dict.get(key)
  ->Option.flatMap(JSON.Decode.string)
  ->Option.flatMap(value => value->String.length > 0 ? Some(value) : None)

let objectAt = (dict, key) =>
  dict->Dict.get(key)->Option.flatMap(JSON.Decode.object)->Option.getOr(Dict.make())

let intAt = (dict, key, fallback) =>
  dict->Dict.get(key)->Option.flatMap(JSON.Decode.float)->Option.mapOr(fallback, Float.toInt)

let nextActionTypeOf = (raw: string): option<nextActionType> =>
  switch raw {
  | "three_ds_invoke" => Some(#three_ds_invoke)
  | "third_party_sdk_session_token" => Some(#third_party_sdk_session_token)
  | "display_bank_transfer_information" => Some(#display_bank_transfer_information)
  | "invoke_ddc" => Some(#invoke_ddc)
  | "redirect_to_url" => Some(#redirect_to_url)
  | _ => None
  }

let readNextAction = (root: Dict.t<JSON.t>, ~type_: nextActionType) => {
  let nextAction = root->objectAt("next_action")

  let threeDsDict = nextAction->objectAt("three_ds_data")
  let pollDict = threeDsDict->objectAt("poll_config")
  let threeDs = switch type_ {
  | #three_ds_invoke =>
    Some({
      VaultNavigation.authenticationUrl: threeDsDict->stringAt("three_ds_authentication_url"),
      authorizeUrl: threeDsDict->stringAt("three_ds_authorize_url"),
      messageVersion: threeDsDict->stringAt("message_version"),
      directoryServerId: threeDsDict->stringAt("directory_server_id"),
      pollId: pollDict->stringAt("poll_id"),
      delayInSecs: pollDict->intAt("delay_in_secs", 0),
      frequency: pollDict->intAt("frequency", 0),
    })
  | _ => None
  }

  let ddc = switch type_ {
  | #invoke_ddc =>
    let ddcDict = nextAction->objectAt("ddc_data")
    Some({
      VaultNavigation.iframeUrl: ddcDict->stringAt("iframe_url"),
      timeoutMs: ddcDict->intAt("timeout_ms", 30000),
    })
  | _ => None
  }

  let sessionToken = switch type_ {
  | #third_party_sdk_session_token =>
    let tokenDict = nextAction->objectAt("session_token")
    Some({
      VaultNavigation.walletName: tokenDict->stringAt("wallet_name"),
      openBankingSessionToken: tokenDict->stringAt("open_banking_session_token"),
    })
  | _ => None
  }

  RequiresAction({
    type_,
    redirectUrl: nextAction->optionalStringAt("redirect_to_url"),
    threeDs,
    ddc,
    sessionToken,
  })
}

let decodeConfirmResponse = (json: JSON.t): navOutcome =>
  switch json->JSON.Decode.object {
  | None => Failed({reason: MalformedResponse})
  | Some(root) =>
    let status = root->stringAt("status")
    let actionType = root->objectAt("next_action")->stringAt("type")->nextActionTypeOf

    switch actionType {
    | Some(#three_ds_invoke as t)
    | Some(#third_party_sdk_session_token as t)
    | Some(#display_bank_transfer_information as t)
    | Some(#invoke_ddc as t) =>
      root->readNextAction(~type_=t)
    | _ =>
      switch status {
      | "succeeded" => Succeeded
      | "requires_capture"
      | "processing"
      | "requires_confirmation"
      | "requires_merchant_action" => Processing
      | "requires_customer_action" => root->readNextAction(~type_=#redirect_to_url)
      | _ => Failed({reason: GenericFailure})
      }
    }
  }

let describeHttpFailure = (parsed: option<JSON.t>, _status: int): navOutcome => {
  let backendCode =
    parsed
    ->Option.flatMap(JSON.Decode.object)
    ->Option.flatMap(root => root->objectAt("error")->optionalStringAt("code"))

  Failed({reason: backendCode->Option.mapOr(GenericFailure, reasonForCode)})
}

@val external encodeURIComponent: string => string = "encodeURIComponent"

let confirmUrl = (~baseUrl, ~paymentId) =>
  `${baseUrl}/payments/${paymentId->encodeURIComponent}/confirm`

let confirmPayment = async (request: finalConfirmRequest): navOutcome => {
  let url = confirmUrl(~baseUrl=request.baseUrl, ~paymentId=request.paymentId)

  let controller = VaultConfirm.makeAbortController()

  request.signal->Option.forEach(callerSignal =>
    if callerSignal->VaultConfirm.signalAborted {
      controller->VaultConfirm.abort
    } else {
      callerSignal->VaultConfirm.onSignalAbort("abort", () => controller->VaultConfirm.abort)
    }
  )

  let timer = switch request.timeoutMs {
  | Some(ms) if ms > 0 => Some(VaultConfirm.setTimeout(() => controller->VaultConfirm.abort, ms))
  | _ => None
  }

  let options: VaultConfirm.fetchOptions = {
    method: "POST",

    headers: [
      ("Content-Type", "application/json"),
      request.credential->VaultCredential.authHeader,
      ("x-app-id", request.appId->VaultConfirm.appIdHeader),
      ("x-redirect-uri", ""),
    ]->Dict.fromArray,
    body: request.body->JSON.stringify,
    signal: ?Some(controller->VaultConfirm.controllerSignal),
  }

  let attempted = try {
    Ok(await VaultConfirm.fetch(url, options))
  } catch {
  | _ => Error()
  }

  timer->Option.forEach(VaultConfirm.clearTimeout)

  switch attempted {
  | Error() =>

    UnknownOutcome
  | Ok(response) =>
    let status = response->VaultConfirm.responseStatus
    let parsed = try {
      Some(await response->VaultConfirm.responseJson)
    } catch {
    | _ => None
    }

    if response->VaultConfirm.responseOk {
      switch parsed {
      | None => Failed({reason: MalformedResponse})
      | Some(json) => json->decodeConfirmResponse
      }
    } else {
      describeHttpFailure(parsed, status)
    }
  }
}
