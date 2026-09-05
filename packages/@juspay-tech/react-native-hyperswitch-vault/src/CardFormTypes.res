type styleObject = ReactNative.Style.t

type cardTheme = {
  borderWidth: float,
  borderRadius: float,
  gap: float,
  inputHeight: float,
  fontFamily: string,
  fontScale: float,
  placeholderTextSizeAdjust: float,
  placeholderColor: string,
  primaryColor: string,
  dangerColor: string,
  textColor: string,
  inputBackground: string,
  dividerColor: string,
  errorBorderColor: string,
  normalBorderColor: string,
  bgStyle: styleObject,
  shadowStyle: styleObject,
}

type cardLabels = {
  cardNumberPlaceholder: string,
  cardNumberFloatingLabel: string,
  expiryPlaceholder: string,
  expiryFloatingLabel: string,
  cvcPlaceholder: string,
  cvcFloatingLabel: string,
  cardholderNamePlaceholder: string,
  cardholderNameFloatingLabel: string,
  notEligibleText: string,

  selectCardBrandLabel: string,
  isRtl: bool,
}

type cardFieldId =
  | CardNumberField
  | ExpiryField
  | CvcField
  | CardholderNameField

type analyticsEvent =
  | FieldFocused(cardFieldId)
  | FieldBlurred(cardFieldId)

type cardFieldValues = {
  cardNumber: string,
  expiryDisplay: string,
  cvc: string,
  cardholderName: string,

  brand: string,

  eligibleSchemes: array<string>,

  isCoBadged: bool,

  savedCard: option<CardStateReducer.savedCard>,
}

type cardFieldErrors = {
  cardNumber?: string,
  cardExpiry?: string,
  cardCvc?: string,
  network?: string,
  eligibility?: string,
}

type cardFieldOk = {
  cardNumber: bool,
  cardExpiry: bool,
  cardCvc: bool,
}
