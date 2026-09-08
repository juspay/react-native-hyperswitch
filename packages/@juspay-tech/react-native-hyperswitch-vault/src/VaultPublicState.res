@genType
type elementType = [#cardNumber | #cardExpiry | #cardCvc | #cardholderName]

@genType
type cardBrand = [
  | #Visa
  | #Mastercard
  | #AmericanExpress
  | #DinersClub
  | #Discover
  | #JCB
  | #CartesBancaires
  | #Interac
  | #Maestro
  | #UnionPay
  | #RuPay
  | #SODEXO
  | #BAJAJ
]

let brandOf = (detected: string): option<cardBrand> =>
  switch CardNetworkNames.normalise(detected) {
  | Some("Visa") => Some(#Visa)
  | Some("Mastercard") => Some(#Mastercard)
  | Some("AmericanExpress") => Some(#AmericanExpress)
  | Some("DinersClub") => Some(#DinersClub)
  | Some("Discover") => Some(#Discover)
  | Some("JCB") => Some(#JCB)
  | Some("CartesBancaires") => Some(#CartesBancaires)
  | Some("Interac") => Some(#Interac)
  | Some("Maestro") => Some(#Maestro)
  | Some("UnionPay") => Some(#UnionPay)
  | Some("RuPay") => Some(#RuPay)
  | Some("SODEXO") => Some(#SODEXO)
  | Some("BAJAJ") => Some(#BAJAJ)
  | _ => None
  }

@genType
type vaultFieldErrorCode = [
  | #required
  | #invalid_card_number
  | #invalid_expiry
  | #invalid_cvc
  | #unsupported_network
]

@genType
type vaultFieldError = {
  code: vaultFieldErrorCode,
  message: string,
}

@genType
type vaultEligibilityStatus = [#unknown | #pending | #allowed | #denied]

@genType
type fieldEvent = {elementType: elementType}

@genType
type fieldChange = {
  elementType: elementType,
  empty: bool,
  complete: bool,
  valid: bool,
  brand?: cardBrand,
  error?: string,

  errorCode?: vaultFieldErrorCode,

  touched: bool,

  isCoBadged?: bool,

  eligibility?: vaultEligibilityStatus,
}

@genType
type vaultSessionStatus = [#valid | #invalid | #absent | #expired | #consumed]

@genType
type vaultFormFields = {
  cardNumber: fieldChange,
  cardExpiry: fieldChange,
  cardCvc: fieldChange,

  cardholderName?: fieldChange,
}

@genType
type cardDetails = {
  bin: Js.Nullable.t<string>,
  extendedBin: Js.Nullable.t<string>,
  last4: Js.Nullable.t<string>,
  brand: Js.Nullable.t<string>,
  expiryMonth: Js.Nullable.t<string>,
  expiryYear: Js.Nullable.t<string>,
  formattedExpiry: Js.Nullable.t<string>,
  isCardNumberComplete: bool,
  isCvcComplete: bool,
  isExpiryComplete: bool,
  isCardNumberValid: bool,
  isExpiryValid: bool,
}

let nullable = (value: option<string>): Js.Nullable.t<string> =>
  switch value {
  | Some(text) => Js.Nullable.return(text)
  | None => Js.Nullable.null
  }

let cardDetailsOf = (info: PaymentEventData.cardInfo): cardDetails => {
  bin: info.bin->nullable,
  extendedBin: info.extendedBin->nullable,
  last4: info.last4->nullable,
  brand: info.brand->nullable,
  expiryMonth: info.expiryMonth->nullable,
  expiryYear: info.expiryYear->nullable,
  formattedExpiry: info.formattedExpiry->nullable,
  isCardNumberComplete: info.isCardNumberComplete,
  isCvcComplete: info.isCvcComplete,
  isExpiryComplete: info.isExpiryComplete,
  isCardNumberValid: info.isCardNumberValid,
  isExpiryValid: info.isExpiryValid,
}

@genType
type cardFormEvent = {elementType: [#cardForm]}

@genType
type cardFormChange = {
  elementType: [#cardForm],
  eventName: [#cardDetailsChange],
  payload: cardDetails,

  fieldsReady: bool,
  sessionStatus: vaultSessionStatus,
  complete: bool,
  valid: bool,
  submitting: bool,
  canSubmit: bool,
  isCoBadged: bool,
  eligibility: vaultEligibilityStatus,

  networkError?: vaultFieldError,
  fields: vaultFormFields,
}

type controllerSnapshot = {
  cardNumber: fieldChange,
  cardExpiry: fieldChange,
  cardCvc: fieldChange,
  cardholderName: fieldChange,
  networkError: option<vaultFieldError>,
  eligibility: vaultEligibilityStatus,
  cardDetails: cardDetails,
}

type fieldInputs = {
  value: string,

  accepted: bool,
  touched: bool,

  visibleError: option<string>,
  invalidCode: vaultFieldErrorCode,
}

let fieldChangeOf = (
  inputs: fieldInputs,
  ~elementType: elementType,
  ~brand: option<cardBrand>=None,
  ~isCoBadged: option<bool>=None,
  ~eligibility: option<vaultEligibilityStatus>=None,
): fieldChange => {
  let empty = inputs.value->String.length === 0
  let valid = inputs.accepted && !empty
  {
    elementType,
    empty,
    complete: valid,
    valid,
    brand: ?brand,
    error: ?inputs.visibleError,
    errorCode: ?inputs.visibleError->Option.map(_ => empty ? #required : inputs.invalidCode),
    touched: inputs.touched,
    isCoBadged: ?isCoBadged,
    eligibility: ?eligibility,
  }
}

let cardholderNameChangeOf = (~value: string, ~touched: bool): fieldChange => {
  let empty = value->String.length === 0
  {elementType: #cardholderName, empty, complete: !empty, valid: true, touched}
}

let formChangeOf = (
  ~fieldsReady: bool,
  ~sessionStatus: vaultSessionStatus,
  ~submitting: bool,
  ~isCoBadged: bool,
  ~eligibility: vaultEligibilityStatus,
  ~networkError: option<vaultFieldError>,
  ~payload: cardDetails,
  ~fields: vaultFormFields,

  ~savedCardMode: bool,
): cardFormChange => {
  let complete = savedCardMode
    ? fields.cardCvc.complete
    : fields.cardNumber.complete && fields.cardExpiry.complete && fields.cardCvc.complete

  let networkFault = fields.cardNumber.complete ? networkError : None
  let valid = complete && networkFault->Option.isNone
  let sessionUsable = switch sessionStatus {
  | #valid | #absent => true
  | #invalid | #expired | #consumed => false
  }
  {
    elementType: #cardForm,
    eventName: #cardDetailsChange,
    payload,
    fieldsReady,
    sessionStatus,
    complete,
    valid,
    submitting,

    canSubmit: fieldsReady && sessionUsable && valid && !submitting,
    isCoBadged,
    eligibility,
    networkError: ?networkFault,
    fields,
  }
}

let errorEq = (a: option<vaultFieldError>, b: option<vaultFieldError>) =>
  switch (a, b) {
  | (None, None) => true
  | (Some(x), Some(y)) => x.code === y.code && x.message === y.message
  | _ => false
  }

let fieldChangeEq = (a: fieldChange, b: fieldChange) =>
  a.elementType === b.elementType &&
  a.empty === b.empty &&
  a.complete === b.complete &&
  a.valid === b.valid &&
  a.brand === b.brand &&
  a.error === b.error &&
  a.errorCode === b.errorCode &&
  a.touched === b.touched &&
  a.isCoBadged === b.isCoBadged &&
  a.eligibility === b.eligibility

let optionalFieldEq = (a: option<fieldChange>, b: option<fieldChange>) =>
  switch (a, b) {
  | (None, None) => true
  | (Some(x), Some(y)) => fieldChangeEq(x, y)
  | _ => false
  }

let fieldsEq = (a: vaultFormFields, b: vaultFormFields) =>
  fieldChangeEq(a.cardNumber, b.cardNumber) &&
  fieldChangeEq(a.cardExpiry, b.cardExpiry) &&
  fieldChangeEq(a.cardCvc, b.cardCvc) &&
  optionalFieldEq(a.cardholderName, b.cardholderName)

let cardDetailsEq = (a: cardDetails, b: cardDetails) => a == b

let formChangeEq = (a: cardFormChange, b: cardFormChange) =>
  cardDetailsEq(a.payload, b.payload) &&
  a.fieldsReady === b.fieldsReady &&
  a.sessionStatus === b.sessionStatus &&
  a.complete === b.complete &&
  a.valid === b.valid &&
  a.submitting === b.submitting &&
  a.canSubmit === b.canSubmit &&
  a.isCoBadged === b.isCoBadged &&
  a.eligibility === b.eligibility &&
  errorEq(a.networkError, b.networkError) &&
  fieldsEq(a.fields, b.fields)
