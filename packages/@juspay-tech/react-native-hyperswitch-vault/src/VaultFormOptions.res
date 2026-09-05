open ReactNative

@genType

type vaultEnvironment = [#PROD | #SANDBOX | #INTEG]

@genType.import(("./merchantTypes", "MerchantSession"))
type vaultSession

external sessionToJson: vaultSession => JSON.t = "%identity"

@genType
type brandIconMode = CardIcons.brandIconMode

@genType
type appearanceVariables = {
  colorPrimary?: string,
  colorText?: string,
  colorDanger?: string,
  colorTextPlaceholder?: string,
  colorBackground?: string,
  borderColor?: string,
  borderRadius?: float,
  fontFamily?: string,
  inputFieldHeight?: float,

  borderWidth?: float,
  gap?: float,
  fontScale?: float,
  placeholderTextSizeAdjust?: float,
  errorTextSizeAdjust?: float,
  errorMessageSpacing?: float,

  cardBrandIcon?: brandIconMode,
}

@genType
type appearance = {
  variables?: appearanceVariables,

  labels?: CardFieldOptions.labelBehavior,
}

@genType
type localisationLabels = {
  cardNumberPlaceholder?: string,
  cardNumberFloatingLabel?: string,
  expiryPlaceholder?: string,
  expiryFloatingLabel?: string,
  cvcPlaceholder?: string,
  cvcFloatingLabel?: string,
  cardholderNamePlaceholder?: string,
  cardholderNameFloatingLabel?: string,

  selectCardBrandLabel?: string,
}

@genType
type localisationMessages = {
  cardNumberRequired?: string,
  cardNumberInvalid?: string,
  expiryRequired?: string,
  expiryInvalid?: string,
  cvcRequired?: string,
  cvcInvalid?: string,

  unsupportedCard?: string,

  cardNotEligible?: string,
}

@genType
type localisation = {
  labels?: localisationLabels,
  validationMessages?: localisationMessages,
  isRtl?: bool,
}

@genType
type safeVaultErrorCode = VaultResult.safeVaultErrorCode

@genType
type safeVaultError = VaultResult.safeVaultError

@genType
type vaultPaymentResult = VaultResult.vaultPaymentResult

@genType
type vaultTokenizeResult = VaultResult.vaultTokenizeResult

@genType
type paymentConfirmInput = VaultFormCoordinator.paymentConfirmInput

@genType
type vaultField = VaultPublicState.elementType

@genType
type eligibilityConfig = {
  paymentId: string,
  sdkAuthorization?: string,
  publishableKey?: string,
  clientSecret?: string,
  appId?: string,
  endpoint?: VaultEndpoint.vaultEndpointConfig,
}

@genType
type vaultFormHandle = {

  tokenize: unit => promise<vaultTokenizeResult>,

  confirmPayment: paymentConfirmInput => promise<vaultPaymentResult>,
  reset: unit => unit,
  focus: vaultField => unit,
}

let emptyStyle = Style.s({})

let variablesOf = (appearance: option<appearance>) =>
  appearance->Option.flatMap(a => a.variables)

let buildTheme = (appearance: option<appearance>): CardFormTypes.cardTheme => {
  let variables = variablesOf(appearance)
  let pick = (selector, fallback) => variables->Option.flatMap(selector)->Option.getOr(fallback)

  let text = pick(v => v.colorText, "#1A1A1A")
  {
    borderWidth: pick(v => v.borderWidth, 1.),
    borderRadius: pick(v => v.borderRadius, 8.),
    gap: pick(v => v.gap, 12.),
    inputHeight: pick(v => v.inputFieldHeight, 48.),
    fontFamily: pick(v => v.fontFamily, "System"),
    fontScale: pick(v => v.fontScale, 1.),
    placeholderTextSizeAdjust: pick(v => v.placeholderTextSizeAdjust, 0.),
    placeholderColor: pick(v => v.colorTextPlaceholder, "#6B7280"),
    primaryColor: pick(v => v.colorPrimary, "#0570DE"),
    dangerColor: pick(v => v.colorDanger, "#DF1B41"),
    textColor: text,
    inputBackground: pick(v => v.colorBackground, "#FFFFFF"),
    dividerColor: pick(v => v.borderColor, "#E6E6E6"),
    errorBorderColor: pick(v => v.colorDanger, "#DF1B41"),
    normalBorderColor: pick(v => v.borderColor, "#E6E6E6"),
    bgStyle: emptyStyle,
    shadowStyle: emptyStyle,
  }
}

let errorTextSizeAdjustOf = (appearance: option<appearance>) =>
  variablesOf(appearance)->Option.flatMap(v => v.errorTextSizeAdjust)->Option.getOr(0.)

let errorMessageSpacingOf = (appearance: option<appearance>) =>
  variablesOf(appearance)->Option.flatMap(v => v.errorMessageSpacing)->Option.getOr(4.)

let cardBrandIconOf = (appearance: option<appearance>): brandIconMode =>
  variablesOf(appearance)
  ->Option.flatMap(v => v.cardBrandIcon)
  ->Option.getOr(CardFieldOptions.defaultBrandIconMode)

let labelsModeOf = (appearance: option<appearance>): CardFieldOptions.labelBehavior =>
  appearance->Option.flatMap(a => a.labels)->Option.getOr(CardFieldOptions.defaultLabelBehavior)

let englishLabels: CardFormTypes.cardLabels = {
  cardNumberPlaceholder: "Card number",
  cardNumberFloatingLabel: "Card number",
  expiryPlaceholder: "MM / YY",
  expiryFloatingLabel: "Expiry",
  cvcPlaceholder: "CVC",
  cvcFloatingLabel: "CVC",
  cardholderNamePlaceholder: "Name on card",
  cardholderNameFloatingLabel: "Name on card",
  notEligibleText: LocaleBundles.english.cardNotEligibleText,
  selectCardBrandLabel: LocaleBundles.english.selectCardBrand,
  isRtl: false,
}

let labelsFromBundle = (bundle: LocaleBundles.bundle): CardFormTypes.cardLabels =>
  LocaleBundles.isEnglish(bundle)
    ? englishLabels
    : {
        cardNumberPlaceholder: bundle.cardNumberLabel,
        cardNumberFloatingLabel: bundle.cardNumberLabel,
        expiryPlaceholder: bundle.expiryPlaceholder,
        expiryFloatingLabel: bundle.validThruText,
        cvcPlaceholder: bundle.cvcTextLabel,
        cvcFloatingLabel: bundle.cvcTextLabel,
        cardholderNamePlaceholder: bundle.cardHolderName,
        cardholderNameFloatingLabel: bundle.cardHolderName,
        notEligibleText: bundle.cardNotEligibleText,
        selectCardBrandLabel: bundle.selectCardBrand,
        isRtl: bundle.localeDirection === "rtl",
      }

let defaultLabels = englishLabels

type resolvedMessages = {
  cardNumberRequired: string,
  cardNumberInvalid: string,
  expiryRequired: string,
  expiryInvalid: string,
  cvcRequired: string,
  cvcInvalid: string,
  unsupportedCard: string,
  cardNotEligible: string,
}

let resolveLabels = (
  localisation: option<localisation>,
  ~bundle: LocaleBundles.bundle,
): CardFormTypes.cardLabels => {
  let base = labelsFromBundle(bundle)
  let labels = localisation->Option.flatMap(l => l.labels)
  let pick = (selector, fallback) => labels->Option.flatMap(selector)->Option.getOr(fallback)
  {
    cardNumberPlaceholder: pick(l => l.cardNumberPlaceholder, base.cardNumberPlaceholder),
    cardNumberFloatingLabel: pick(l => l.cardNumberFloatingLabel, base.cardNumberFloatingLabel),
    expiryPlaceholder: pick(l => l.expiryPlaceholder, base.expiryPlaceholder),
    expiryFloatingLabel: pick(l => l.expiryFloatingLabel, base.expiryFloatingLabel),
    cvcPlaceholder: pick(l => l.cvcPlaceholder, base.cvcPlaceholder),
    cvcFloatingLabel: pick(l => l.cvcFloatingLabel, base.cvcFloatingLabel),
    cardholderNamePlaceholder: pick(
      l => l.cardholderNamePlaceholder,
      base.cardholderNamePlaceholder,
    ),
    cardholderNameFloatingLabel: pick(
      l => l.cardholderNameFloatingLabel,
      base.cardholderNameFloatingLabel,
    ),
    notEligibleText: base.notEligibleText,
    selectCardBrandLabel: pick(l => l.selectCardBrandLabel, base.selectCardBrandLabel),
    isRtl: localisation->Option.flatMap(l => l.isRtl)->Option.getOr(base.isRtl),
  }
}

let resolveMessages = (
  localisation: option<localisation>,
  ~bundle: LocaleBundles.bundle,
): resolvedMessages => {
  let messages = localisation->Option.flatMap(l => l.validationMessages)
  let pick = (selector, fallback) => messages->Option.flatMap(selector)->Option.getOr(fallback)
  {
    cardNumberRequired: pick(m => m.cardNumberRequired, bundle.cardNumberEmptyText),
    cardNumberInvalid: pick(m => m.cardNumberInvalid, bundle.inValidCardErrorText),
    expiryRequired: pick(m => m.expiryRequired, bundle.cardExpiryDateEmptyText),
    expiryInvalid: pick(m => m.expiryInvalid, bundle.inValidExpiryErrorText),
    cvcRequired: pick(m => m.cvcRequired, bundle.cvcNumberEmptyText),
    cvcInvalid: pick(m => m.cvcInvalid, bundle.inValidCVCErrorText),
    unsupportedCard: pick(m => m.unsupportedCard, bundle.unsupportedCardErrorText),
    cardNotEligible: pick(m => m.cardNotEligible, bundle.cardNotEligibleText),
  }
}

let makeNetworkValidator = (
  ~enabledCardSchemes: array<string>,
  messages: resolvedMessages,
): option<option<string> => option<string>> =>
  enabledCardSchemes->Array.length === 0
    ? None
    : Some(
        (value: option<string>) => {
          let network = value->Option.getOr("")

          network->String.length === 0 ||
          enabledCardSchemes->Array.some(scheme => scheme === network)
            ? None
            : Some(messages.unsupportedCard)
        },
      )

let makeCardNumberValidator = (messages: resolvedMessages) => (value: option<string>) => {
  let value = value->Option.getOr("")
  if value->String.length === 0 {
    Some(messages.cardNumberRequired)
  } else {
    let cardBrand = value->Validation.getCardBrand
    let formattedNumber = Validation.formatCardNumber(value, cardBrand->Validation.cardType)
    Validation.cardValid(formattedNumber, cardBrand) ? None : Some(messages.cardNumberInvalid)
  }
}

let makeExpiryValidatorWith = (messages: resolvedMessages) => (expiry: string) => (
  _: option<string>,
) =>
  if expiry->String.length === 0 {
    Some(messages.expiryRequired)
  } else if Validation.checkCardExpiry(expiry) {
    None
  } else {
    Some(messages.expiryInvalid)
  }

let makeCvcValidatorWith = (messages: resolvedMessages) => (cardBrand: string) => (
  value: option<string>,
) => {
  let value = value->Option.getOr("")
  if value->String.length === 0 {
    Some(messages.cvcRequired)
  } else if Validation.checkCardCVC(value, cardBrand) {
    None
  } else {
    Some(messages.cvcInvalid)
  }
}
