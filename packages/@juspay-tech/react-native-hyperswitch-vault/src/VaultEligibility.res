type verdict =
  | Allowed
  | Denied

type eligibilityRequest = {
  baseUrl: string,
  paymentId: string,
  credential: VaultCredential.t,
  appId: option<string>,
  cardNumber: string,
  signal?: VaultConfirm.abortSignal,
}

@val external encodeURIComponent: string => string = "encodeURIComponent"

let eligibilityUrl = (~baseUrl, ~paymentId) =>
  `${baseUrl}/payments/${paymentId->encodeURIComponent}/eligibility`

let appIdHeader = VaultConfirm.appIdHeader

let buildBody = (~cardNumber: string): string =>
  [
    ("payment_method_type", "card"->JSON.Encode.string),
    (
      "payment_method_data",
      [
        (
          "card",
          [("card_number", cardNumber->Validation.clearSpaces->JSON.Encode.string)]
          ->Dict.fromArray
          ->JSON.Encode.object,
        ),
      ]
      ->Dict.fromArray
      ->JSON.Encode.object,
    ),
  ]
  ->Dict.fromArray
  ->JSON.Encode.object
  ->JSON.stringify

let readVerdict = (json: JSON.t): verdict => {
  let nextAction =
    json
    ->JSON.Decode.object
    ->Option.flatMap(root => root->Dict.get("sdk_next_action"))
    ->Option.flatMap(JSON.Decode.object)
    ->Option.flatMap(action => action->Dict.get("next_action"))

  switch nextAction {
  | None => Allowed
  | Some(value) =>
    switch value->JSON.Decode.string {
    | Some("deny") => Denied
    | Some(_) => Allowed
    | None =>
      value
      ->JSON.Decode.object
      ->Option.flatMap(dict => dict->Dict.get("deny"))
      ->Option.isSome
        ? Denied
        : Allowed
    }
  }
}

let check = async (request: eligibilityRequest): verdict => {
  let options: VaultConfirm.fetchOptions = {
    method: "POST",
    headers: [
      ("Content-Type", "application/json"),
      request.credential->VaultCredential.authHeader,
      ("x-app-id", request.appId->appIdHeader),
      ("x-redirect-uri", ""),
    ]->Dict.fromArray,
    body: buildBody(~cardNumber=request.cardNumber),
    signal: ?request.signal,
  }

  let attempted = try {
    Ok(
      await VaultConfirm.fetch(
        eligibilityUrl(~baseUrl=request.baseUrl, ~paymentId=request.paymentId),
        options,
      ),
    )
  } catch {
  | _ => Error()
  }

  switch attempted {
  | Error() => Allowed
  | Ok(response) =>
    if response->VaultConfirm.responseOk {
      let parsed = try {
        Some(await response->VaultConfirm.responseJson)
      } catch {
      | _ => None
      }
      switch parsed {
      | Some(json) => json->readVerdict
      | None => Allowed
      }
    } else {
      Allowed
    }
  }
}
