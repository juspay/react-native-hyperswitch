// The values of the vault's debugging logs, worked out apart from React so they can be tested: what
// the customer left in a field and how the merchant set the form up. None of them carries a card
// value, a URL or a session secret.

// What a field held when it lost focus, in the public field error codes (a field change's
// errorCode): empty, complete, or the code of what is wrong with it. As in the form's public state,
// a card network the form does not accept counts only once the number is complete.
let fieldStatus = (~empty, ~complete, ~invalidCode: string, ~unsupportedNetwork) =>
  if empty {
    "empty"
  } else if !complete {
    invalidCode
  } else if unsupportedNetwork {
    "unsupported_network"
  } else {
    "complete"
  }

// BLUR's value: the field's public name and its status, e.g. "cardNumber invalid_card_number".
let blurValue = (~field, ~status) => `${field} ${status}`

// A session the form was given but cannot save a card with: PAYMENT_ELEMENT_OPTIONS is then an
// error. No session yet is not one: a form can mount before its session arrives.
let isUnusableSession = (sessionStatus: string) =>
  switch sessionStatus {
  | "invalid" | "expired" => true
  | _ => false
  }

// The merchant's own text (a locale, a card scheme name, the name field's mode) is kept only when it
// looks like one, so a value passed by mistake is never copied into a log. A scheme name has a letter
// in it, so digits alone, such as a card number, are not one.
let unrecognised = "unrecognised"
let keepIf = (value: string, pattern: RegExp.t) =>
  pattern->RegExp.test(value) ? value : unrecognised
let localeOf = (locale: string) =>
  locale === "" ? "" : locale->keepIf(%re("/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{1,8}){0,3}$/"))
let schemeNamesOf = (names: array<string>) =>
  names
  ->Array.slice(~start=0, ~end=10)
  ->Array.map(name => name->keepIf(%re("/^(?=[^A-Za-z]*[A-Za-z])[A-Za-z0-9 _-]{1,32}$/")))
let cardholderNameModeOf = (mode: string) =>
  switch mode {
  | "collect" | "external" | "omit" => mode
  | _ => unrecognised
  }

type formOptions = {
  environment: string,
  sessionStatus: string,
  sessionProblem: string,
  customEndpoints: option<VaultEndpoint.customEndpoints>,
  enabledCardSchemes: array<string>,
  unknownCardSchemes: array<string>,
  cardholderNameMode: string,
  locale: string,
  fields: array<string>,
  savedCard: bool,
}

let isSet = (endpoint: option<string>) => endpoint->Option.mapOr(false, value => value !== "")

// PAYMENT_ELEMENT_OPTIONS's value, the event web logs a merchant's options under: the settings that
// decide what the form accepts and where it confirms. A custom endpoint is recorded only as set or
// not, never as its URL. As a backstop, a run of digits shaped like a card number is blanked out of
// the whole value, as out of the vault's error logs.
let optionsValue = (options: formOptions) => {
  let endpoints = options.customEndpoints->VaultEndpoint.normalize
  let overrides = endpoints->Option.flatMap(endpoints => endpoints.overrideEndpoints)
  let flag = (name, endpoint) => (name, endpoint->isSet->JSON.Encode.bool)
  let strings = values => values->Array.map(JSON.Encode.string)->JSON.Encode.array
  [
    ("environment", options.environment->JSON.Encode.string),
    ("sessionStatus", options.sessionStatus->JSON.Encode.string),
    ("sessionProblem", options.sessionProblem->JSON.Encode.string),
    (
      "customEndpoints",
      [
        flag("commonEndpoint", endpoints->Option.flatMap(endpoints => endpoints.commonEndpoint)),
        flag(
          "customBackendEndpoint",
          overrides->Option.flatMap(overrides => overrides.customBackendEndpoint),
        ),
        flag(
          "customLoggingEndpoint",
          overrides->Option.flatMap(overrides => overrides.customLoggingEndpoint),
        ),
      ]
      ->Dict.fromArray
      ->JSON.Encode.object,
    ),
    ("enabledCardSchemes", options.enabledCardSchemes->strings),
    ("unknownCardSchemes", options.unknownCardSchemes->schemeNamesOf->strings),
    // How the form treats the name field (collect, external or omit), never a name.
    ("cardholderNameMode", options.cardholderNameMode->cardholderNameModeOf->JSON.Encode.string),
    ("locale", options.locale->localeOf->JSON.Encode.string),
    ("fields", options.fields->strings),
    ("savedCard", options.savedCard->JSON.Encode.bool),
  ]
  ->Dict.fromArray
  ->JSON.Encode.object
  ->JSON.stringify
  ->VaultLogger.redactDigits
}
