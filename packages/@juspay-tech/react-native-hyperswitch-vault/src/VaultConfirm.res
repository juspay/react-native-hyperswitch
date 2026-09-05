type vaultEnvironment = [#PROD | #SANDBOX | #INTEG]

type cardDetails = {
  cardNumber: string,

  expiryMonth: string,

  expiryYear: string,
  cvc: string,
}

type abortSignal

type confirmRequest = {
  sdkAuthorization: string,

  vaultBaseUrl: string,

  appId?: string,
  card: cardDetails,

  cardholderName?: string,

  cardNetwork?: string,

  nickName?: string,

  timeoutMs?: int,

  signal?: abortSignal,
}

type vaultCardMetadata = {
  last4Digits: string,

  binNumber?: string,
  expiryMonth: string,
  expiryYear: string,

  network?: string,
}

type vaultConfirmResult = {
  token: string,
  card: vaultCardMetadata,
}

type vaultErrorCode = [
  | #invalid_authorization
  | #missing_session_id
  | #invalid_card_data
  | #unknown_outcome
  | #http_error
  | #malformed_response
  | #missing_token
]

type vaultError = {
  code: vaultErrorCode,

  message: string,
  httpStatus?: int,

  retryable: bool,

  unknownOutcome: bool,
}

@tag("status")
type confirmOutcome =
  | @as("success") Success({result: vaultConfirmResult})
  | @as("failure") Failure({error: vaultError})

let base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

let decodeBase64 = (input: string): option<string> => {
  let normalized =
    input
    ->String.replaceRegExp(%re("/\s/g"), "")
    ->String.replaceAll("-", "+")
    ->String.replaceAll("_", "/")
    ->String.replaceRegExp(%re("/=+$/"), "")

  let length = normalized->String.length
  let out = ref("")
  let buffer = ref(0)
  let bits = ref(0)
  let valid = ref(true)
  let index = ref(0)

  while valid.contents && index.contents < length {
    let symbol = normalized->String.charAt(index.contents)
    let position = base64Alphabet->String.indexOf(symbol)
    if position < 0 {
      valid := false
    } else {
      buffer := buffer.contents * 64 + position
      bits := bits.contents + 6
      if bits.contents >= 8 {
        bits := bits.contents - 8
        let divisor = switch bits.contents {
        | 2 => 4
        | 4 => 16
        | _ => 1
        }
        out := out.contents ++ String.fromCharCode(buffer.contents / divisor)
        buffer := mod(buffer.contents, divisor)
      }
      index := index.contents + 1
    }
  }

  valid.contents ? Some(out.contents) : None
}

let configurationError = (code, message) =>
  Failure({error: {code, message, retryable: false, unknownOutcome: false}})

let unknownOutcomeError = message =>
  Failure({
    error: {code: #unknown_outcome, message, retryable: false, unknownOutcome: true},
  })

let retryableForStatus = (_status: int, _code: option<string>) => false

let publicMessageForCode = (code: string) =>
  switch code {
  | "IR_00" | "IR_01" | "IR_03" => Some("The vault session could not be authorized.")
  | "IR_05" | "IR_06" => Some("The card details were rejected by the vault.")
  | "IR_16" => Some("The vault session has already been used.")
  | "IR_24" => Some("The vault session has expired.")
  | _ => None
  }

let readSessionId = (decoded: string): option<string> =>
  decoded
  ->String.split(",")
  ->Array.reduce(None, (found, pair) =>
    switch found {
    | Some(_) => found
    | None =>
      let separator = pair->String.indexOf("=")
      if separator <= 0 {
        None
      } else {
        let key = pair->String.slice(~start=0, ~end=separator)->String.trim
        let value = pair->String.sliceToEnd(~start=separator + 1)->String.trim
        key === "payment_method_session_id" && value->String.length > 0 ? Some(value) : None
      }
    }
  )

let resolveSessionId = (sdkAuthorization: string): result<string, confirmOutcome> =>
  if sdkAuthorization->String.trim->String.length === 0 {
    Error(configurationError(#invalid_authorization, "sdkAuthorization is empty."))
  } else {
    switch sdkAuthorization->decodeBase64 {
    | None =>
      Error(configurationError(#invalid_authorization, "sdkAuthorization is not valid base64."))
    | Some(decoded) =>
      switch decoded->readSessionId {
      | None =>
        Error(
          configurationError(
            #missing_session_id,
            "sdkAuthorization does not contain payment_method_session_id.",
          ),
        )
      | Some(sessionId) => Ok(sessionId)
      }
    }
  }

let twoDigitYear = (year: string) => {
  let digits = year->Validation.clearSpaces
  let length = digits->String.length
  length > 2 ? digits->String.sliceToEnd(~start=length - 2) : digits
}

let requestExpiryYear = (year: string) => {
  let digits = year->Validation.clearSpaces
  if digits->String.length >= 4 {
    digits
  } else {
    let (_, expanded) = Validation.getExpiryDates(`01 / ${digits->twoDigitYear}`)
    expanded
  }
}

let detectBrand = (cardNumber: string) =>
  cardNumber
  ->Validation.clearSpaces
  ->Validation.getAllMatchedCardSchemes
  ->Array.get(0)
  ->Option.getOr("")

let validateCard = (card: cardDetails): option<confirmOutcome> => {
  let cleaned = card.cardNumber->Validation.clearSpaces
  let brand = card.cardNumber->detectBrand
  let expiryForValidation = `${card.expiryMonth} / ${card.expiryYear->twoDigitYear}`

  if cleaned->String.length === 0 {
    Some(configurationError(#invalid_card_data, "Card number is required."))
  } else if !Validation.cardValid(cleaned, brand) {
    Some(configurationError(#invalid_card_data, "Card number is not valid."))
  } else if !Validation.checkCardExpiry(expiryForValidation) {
    Some(configurationError(#invalid_card_data, "Card expiry is not valid."))
  } else if !Validation.checkCardCVC(card.cvc, brand) {
    Some(configurationError(#invalid_card_data, "Card security code is not valid."))
  } else {
    None
  }
}

let vaultBaseUrl = (environment: vaultEnvironment) =>
  switch environment {
  | #PROD => "https://live.hyperswitch.io/api"
  | #SANDBOX => "https://app.hyperswitch.io/api"
  | #INTEG => "https://integ.hyperswitch.io/api"
  }

@val external encodeURIComponent: string => string = "encodeURIComponent"

let confirmUrl = (~baseUrl, ~sessionId) =>
  `${baseUrl}/v1/payment-method-sessions/${sessionId->encodeURIComponent}/confirm`

let appIdHeader = (appId: option<string>) =>
  appId->Option.getOr("")->String.replace(".hyperswitch://", "")

let optionalEntry = (key, value: option<string>) =>
  switch value {
  | Some(text) if text->String.trim->String.length > 0 =>
    [(key, text->String.trim->JSON.Encode.string)]
  | _ => []
  }

let buildConfirmBody = (
  card: cardDetails,
  ~cardholderName: option<string>=?,
  ~nickName: option<string>=?,

  ~cardNetwork: option<string>=?,
) => {
  let cardObject =
    [
      ("card_number", card.cardNumber->Validation.clearSpaces->JSON.Encode.string),
      ("card_exp_month", card.expiryMonth->JSON.Encode.string),
      ("card_exp_year", card.expiryYear->requestExpiryYear->JSON.Encode.string),
      ("card_cvc", card.cvc->JSON.Encode.string),
    ]
    ->Array.concat(optionalEntry("card_holder_name", cardholderName))
    ->Array.concat(optionalEntry("card_network", cardNetwork))
    ->Array.concat(optionalEntry("nick_name", nickName))
    ->Dict.fromArray
    ->JSON.Encode.object

  [
    ("payment_method_type", "card"->JSON.Encode.string),
    ("payment_method_data", [("card", cardObject)]->Dict.fromArray->JSON.Encode.object),
  ]
  ->Dict.fromArray
  ->JSON.Encode.object
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

let decodeConfirmResponse = (json: JSON.t, ~httpStatus: int): confirmOutcome =>
  switch json->JSON.Decode.object {
  | None =>
    Failure({
      error: {
        code: #malformed_response,
        message: "The vault response could not be read.",
        httpStatus,
        retryable: false,
        unknownOutcome: false,
      },
    })
  | Some(root) =>
    let token =
      root
      ->Dict.get("associated_payment_methods")
      ->Option.flatMap(JSON.Decode.array)
      ->Option.flatMap(entries => entries->Array.get(0))
      ->Option.flatMap(JSON.Decode.object)
      ->Option.mapOr("", entry => entry->objectAt("payment_method_token")->stringAt("data"))

    if token->String.length === 0 {
      Failure({
        error: {
          code: #missing_token,
          message: "The vault response did not contain a payment method token.",
          httpStatus,
          retryable: false,
          unknownOutcome: false,
        },
      })
    } else {
      let card = root->objectAt("payment_method_data")->objectAt("card")
      Success({
        result: {
          token,
          card: {
            last4Digits: card->stringAt("last4_digits"),
            binNumber: ?card->optionalStringAt("card_isin"),
            expiryMonth: card->stringAt("expiry_month"),
            expiryYear: card->stringAt("expiry_year"),
            network: ?card->optionalStringAt("card_network"),
          },
        },
      })
    }
  }

let describeHttpFailure = (parsed: option<JSON.t>, status: int): confirmOutcome => {
  let backendCode =
    parsed
    ->Option.flatMap(JSON.Decode.object)
    ->Option.flatMap(root => root->objectAt("error")->optionalStringAt("code"))

  let message =
    backendCode
    ->Option.flatMap(publicMessageForCode)
    ->Option.getOr("The vault could not confirm the payment method.")

  Failure({
    error: {
      code: #http_error,
      message,
      httpStatus: status,
      retryable: retryableForStatus(status, backendCode),
      unknownOutcome: false,
    },
  })
}

type fetchResponse

type fetchOptions = {
  method: string,
  headers: Dict.t<string>,
  body: string,
  signal?: abortSignal,
}

type abortController

@val external fetch: (string, fetchOptions) => promise<fetchResponse> = "fetch"
@get external responseOk: fetchResponse => bool = "ok"
@get external responseStatus: fetchResponse => int = "status"
@send external responseJson: fetchResponse => promise<JSON.t> = "json"

@new external makeAbortController: unit => abortController = "AbortController"
@get external controllerSignal: abortController => abortSignal = "signal"
@send external abort: abortController => unit = "abort"
@get external signalAborted: abortSignal => bool = "aborted"
@send external onSignalAbort: (abortSignal, string, unit => unit) => unit = "addEventListener"

type timerId
@val external setTimeout: (unit => unit, int) => timerId = "setTimeout"
@val external clearTimeout: timerId => unit = "clearTimeout"

let confirmPaymentMethodSession = async (request: confirmRequest): confirmOutcome => {
  switch request.card->validateCard {
  | Some(invalid) => invalid
  | None =>
    switch request.sdkAuthorization->resolveSessionId {
    | Error(configurationFailure) => configurationFailure
    | Ok(sessionId) =>
      let url = confirmUrl(~baseUrl=request.vaultBaseUrl, ~sessionId)

      let controller = makeAbortController()

      request.signal->Option.forEach(callerSignal =>
        if callerSignal->signalAborted {
          controller->abort
        } else {
          callerSignal->onSignalAbort("abort", () => controller->abort)
        }
      )

      let timedOut = ref(false)
      let timer = switch request.timeoutMs {
      | Some(ms) if ms > 0 =>
        Some(
          setTimeout(() => {
            timedOut := true
            controller->abort
          }, ms),
        )
      | _ => None
      }

      let options = {
        method: "POST",

        headers: [
          ("Content-Type", "application/json"),
          ("Authorization", request.sdkAuthorization),
          ("x-app-id", request.appId->appIdHeader),
          ("x-redirect-uri", ""),
        ]->Dict.fromArray,
        body: request.card
        ->buildConfirmBody(
          ~cardholderName=?request.cardholderName,
          ~nickName=?request.nickName,
          ~cardNetwork=?request.cardNetwork,
        )
        ->JSON.stringify,
        signal: ?Some(controller->controllerSignal),
      }

      let attempted = try {
        Ok(await fetch(url, options))
      } catch {
      | _ => Error()
      }

      timer->Option.forEach(clearTimeout)

      switch attempted {
      | Error() =>

        unknownOutcomeError(
          timedOut.contents
            ? "The vault did not respond in time; the outcome is unknown."
            : "The vault request did not complete; the outcome is unknown.",
        )
      | Ok(response) =>
        let status = response->responseStatus
        let parsed = try {
          Some(await response->responseJson)
        } catch {
        | _ => None
        }

        if response->responseOk {
          switch parsed {
          | None =>
            Failure({
              error: {
                code: #malformed_response,
                message: "The vault response was not valid JSON.",
                httpStatus: status,
                retryable: false,
                unknownOutcome: false,
              },
            })
          | Some(json) => json->decodeConfirmResponse(~httpStatus=status)
          }
        } else {
          describeHttpFailure(parsed, status)
        }
      }
    }
  }
}
