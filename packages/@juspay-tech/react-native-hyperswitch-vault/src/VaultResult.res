@genType
type safeVaultErrorCode = [

  | #validation_error
  | #incomplete_field_set
  | #session_expired
  | #session_consumed
  | #tokenization_in_progress
  | #confirm_in_progress
  | #tokenization_failed

  | #invalid_session
  | #unsupported_configuration
  | #unknown_outcome
  | #payment_failed
  | #forbidden_card_data

  | #card_not_eligible
]

@genType
type safeVaultErrorType = [#validation_error | #api_error | #card_error]

let typeOf = (code: safeVaultErrorCode): safeVaultErrorType =>
  switch code {
  | #validation_error | #incomplete_field_set | #forbidden_card_data => #validation_error
  | #card_not_eligible => #card_error
  | #session_expired
  | #session_consumed
  | #tokenization_in_progress
  | #confirm_in_progress
  | #tokenization_failed
  | #invalid_session
  | #unsupported_configuration
  | #unknown_outcome
  | #payment_failed =>
    #api_error
  }

@genType
type safeVaultError = {
  code: safeVaultErrorCode,

  message: string,
  @as("type") type_: safeVaultErrorType,
}

let errorOf = (code, message): safeVaultError => {code, message, type_: typeOf(code)}

@genType
type nextActionType = VaultNavigation.nextActionType

@genType
type safeThreeDs = VaultNavigation.safeThreeDs

@genType
type safeDdc = VaultNavigation.safeDdc

@genType
type safeSessionToken = VaultNavigation.safeSessionToken

@genType
type safeNextAction = VaultNavigation.safeNextAction

@genType
type vaultPaymentStatus = [
  | #succeeded
  | #processing
  | #requires_customer_action
  | #failed
  | #validation_error
]

@genType
type vaultTokenizeStatus = [#success | #validation_error | #error]

@genType
type vaultPaymentResult = {
  status: vaultPaymentStatus,
  error?: safeVaultError,
  nextAction?: safeNextAction,
}

@genType
type vaultTokenizedCard = {
  bin?: string,
  last4: string,
  brand?: string,
  expiryMonth: string,
  expiryYear: string,
}

@genType
type vaultTokenizeResult = {
  status: vaultTokenizeStatus,
  token?: string,
  card?: vaultTokenizedCard,
  error?: safeVaultError,
}

let tokenizedCardOf = (metadata: VaultConfirm.vaultCardMetadata): option<vaultTokenizedCard> => {
  let described =
    metadata.last4Digits->String.length > 0 ||
    metadata.binNumber->Option.isSome ||
    metadata.expiryMonth->String.length > 0
  let last4 = metadata.last4Digits
  let expiryMonth = metadata.expiryMonth
  let expiryYear = metadata.expiryYear

  described
    ? Some(
        switch (metadata.binNumber, metadata.network) {
        | (Some(bin), Some(brand)) => {bin, last4, brand, expiryMonth, expiryYear}
        | (Some(bin), None) => {bin, last4, expiryMonth, expiryYear}
        | (None, Some(brand)) => {last4, brand, expiryMonth, expiryYear}
        | (None, None) => {last4, expiryMonth, expiryYear}
        },
      )
    : None
}

let invalidCardMessage = "Please check your card details and try again."
let incompleteFieldSetMessage = "Mount a card-number, expiry and CVC field, or one CVC field with a saved card, before submitting."
let unusableSessionMessage = "This session can no longer be used."
let sessionExpiredMessage = "This payment method session has expired."
let sessionConsumedMessage = "This payment method session has already been used."
let tokenizationInProgressMessage = "A tokenization is already in progress for this session."
let confirmInProgressMessage = "A payment confirmation is already in progress for this session."
let unknownOutcomeMessage = "We could not confirm the payment. Please check before trying again."
let tokenizationFailedMessage = "The card could not be tokenized."
let paymentFailedMessage = "The payment could not be completed."
let unauthorizedMessage = "The payment session could not be authorized."
let rejectedMessage = "The payment details were rejected."
let sessionAlreadyUsedMessage = "This payment session has already been used."
let malformedResponseMessage = "The payment response could not be read."
let forbiddenCardDataMessage = "Card data must not be supplied by the host; the library owns the card fields."
let unsupportedConfigurationMessage = "This payment cannot be completed with the current configuration."
let cardNotEligibleMessage = "This card is not accepted for this payment."

let failedWith = (code, message): vaultPaymentResult => {
  status: #failed,
  error: errorOf(code, message),
}

let validationError = (message): vaultPaymentResult => {
  status: #validation_error,
  error: errorOf(#validation_error, message),
}

let invalidCardData = () => validationError(invalidCardMessage)

let incompleteFieldSet = (message): vaultPaymentResult => {
  status: #validation_error,
  error: errorOf(#incomplete_field_set, message),
}

let invalidSession = message => failedWith(#invalid_session, message)
let sessionExpired = () => failedWith(#session_expired, sessionExpiredMessage)
let sessionConsumed = () => failedWith(#session_consumed, sessionConsumedMessage)
let tokenizationInProgress = () =>
  failedWith(#tokenization_in_progress, tokenizationInProgressMessage)
let forbiddenCardData = () => failedWith(#forbidden_card_data, forbiddenCardDataMessage)
let unsupportedConfiguration = () =>
  failedWith(#unsupported_configuration, unsupportedConfigurationMessage)

let cardNotEligible = () => failedWith(#card_not_eligible, cardNotEligibleMessage)
let unknownOutcome = () => failedWith(#unknown_outcome, unknownOutcomeMessage)

let tokenizeSuccess = (~card=?, token): vaultTokenizeResult =>
  switch card {
  | Some(card) => {status: #success, token, card}
  | None => {status: #success, token}
  }

let tokenizeFailedWith = (code, message): vaultTokenizeResult => {
  status: #error,
  error: errorOf(code, message),
}

let tokenizeValidationError = (message): vaultTokenizeResult => {
  status: #validation_error,
  error: errorOf(#validation_error, message),
}

let tokenizeInvalidCardData = () => tokenizeValidationError(invalidCardMessage)

let tokenizeIncompleteFieldSet = (message): vaultTokenizeResult => {
  status: #validation_error,
  error: errorOf(#incomplete_field_set, message),
}

let tokenizeSessionExpired = () => tokenizeFailedWith(#session_expired, sessionExpiredMessage)
let tokenizeSessionConsumed = () => tokenizeFailedWith(#session_consumed, sessionConsumedMessage)
let tokenizeConfirmInProgress = () =>
  tokenizeFailedWith(#confirm_in_progress, confirmInProgressMessage)

let tokenizeFromPmsFailure = (error: VaultConfirm.vaultError): vaultTokenizeResult =>
  switch error.code {
  | #invalid_card_data => tokenizeInvalidCardData()
  | #invalid_authorization
  | #missing_session_id =>
    tokenizeFailedWith(#invalid_session, unusableSessionMessage)
  | #unknown_outcome => tokenizeFailedWith(#unknown_outcome, unknownOutcomeMessage)
  | #http_error
  | #malformed_response
  | #missing_token =>
    tokenizeFailedWith(#tokenization_failed, error.message)
  }

let fromPmsFailure = (error: VaultConfirm.vaultError): vaultPaymentResult =>
  switch error.code {
  | #invalid_card_data => invalidCardData()
  | #invalid_authorization
  | #missing_session_id =>
    invalidSession(unusableSessionMessage)
  | #unknown_outcome => unknownOutcome()
  | #http_error
  | #malformed_response
  | #missing_token =>
    failedWith(#tokenization_failed, error.message)
  }

let fromNavOutcome = (outcome: VaultFinalConfirm.navOutcome): vaultPaymentResult =>
  switch outcome {
  | VaultFinalConfirm.Succeeded => {status: #succeeded}
  | VaultFinalConfirm.Processing => {status: #processing}
  | VaultFinalConfirm.RequiresAction({type_, redirectUrl, threeDs, ddc, sessionToken}) => {
      status: #requires_customer_action,
      nextAction: {
        VaultNavigation.type_,
        redirectUrl: ?redirectUrl,
        threeDs: ?threeDs,
        ddc: ?ddc,
        sessionToken: ?sessionToken,
      },
    }

  | VaultFinalConfirm.Failed({reason}) =>
    switch reason {
    | VaultFinalConfirm.Unauthorized => failedWith(#payment_failed, unauthorizedMessage)
    | VaultFinalConfirm.Rejected => failedWith(#payment_failed, rejectedMessage)
    | VaultFinalConfirm.SessionAlreadyUsed => failedWith(#session_consumed, sessionAlreadyUsedMessage)
    | VaultFinalConfirm.SessionExpired => failedWith(#session_expired, sessionExpiredMessage)
    | VaultFinalConfirm.MalformedResponse => failedWith(#payment_failed, malformedResponseMessage)
    | VaultFinalConfirm.GenericFailure => failedWith(#payment_failed, paymentFailedMessage)
    }
  | VaultFinalConfirm.UnknownOutcome => failedWith(#unknown_outcome, unknownOutcomeMessage)
  }
