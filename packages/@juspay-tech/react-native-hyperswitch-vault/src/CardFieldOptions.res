@genType

type labelBehavior = [#above | #floating | #never]

@genType
type errorDisplay = [#none | #colorOnly | #inline]

@genType
type brandIconMode = CardIcons.brandIconMode

@genType

type cvcIconDisplay = [#hidden | #default]

@genType
type fieldOptions = {
  placeholder?: string,
  label?: string,
  labelBehavior?: labelBehavior,
  errorDisplay?: errorDisplay,
  accessibilityLabel?: string,
  accessibilityHint?: string,
  testID?: string,

  unstyled?: bool,
}

@genType
type cardNumberOptions = {
  placeholder?: string,
  label?: string,
  labelBehavior?: labelBehavior,
  errorDisplay?: errorDisplay,
  accessibilityLabel?: string,
  accessibilityHint?: string,
  testID?: string,

  unstyled?: bool,

  cardBrandIcon?: brandIconMode,
}

@genType
type expiryOptions = fieldOptions

@genType
type cardholderNameOptions = fieldOptions

@genType

@genType
type savedCardData = {cardNetwork?: string}

@genType
type savedCardPaymentMethodData = {card?: savedCardData}

@genType
type savedCard = {
  paymentMethodToken?: string,
  paymentMethodData?: savedCardPaymentMethodData,
}

let savedCardToken = (saved: savedCard) =>
  saved.paymentMethodToken->Option.map(String.trim)->Option.getOr("")

let savedCardNetwork = (saved: savedCard) =>
  saved.paymentMethodData
  ->Option.flatMap(data => data.card)
  ->Option.flatMap(card => card.cardNetwork)
  ->Option.getOr("")

@genType
type cvcOptions = {
  placeholder?: string,
  label?: string,
  labelBehavior?: labelBehavior,
  errorDisplay?: errorDisplay,
  accessibilityLabel?: string,
  accessibilityHint?: string,
  testID?: string,

  unstyled?: bool,

  cvcIcon?: cvcIconDisplay,

  savedCard?: savedCard,
}

@genType
type formFieldOptions = {
  cardNumber?: cardNumberOptions,
  cardExpiry?: expiryOptions,
  cardCvc?: cvcOptions,
  cardholderName?: cardholderNameOptions,
}

@genType
type cardholderNameMode = [#collect | #"external" | #omit]

@genType
type formLayout = [#stacked | #inline]

@genType
type fieldArrangement = [#separate | #fused]

type resolved = {
  placeholder: option<string>,
  label: option<string>,
  labelBehavior: labelBehavior,
  errorDisplay: errorDisplay,
  accessibilityLabel: string,
  accessibilityHint: option<string>,
  testID: string,
  unstyled: bool,
}

type textChoice =
  | Inherit
  | Off
  | Text(string)

let merchantText = (value: option<string>): textChoice =>
  switch value {
  | None => Inherit
  | Some(text) =>
    let text = text->String.trim
    text === "" ? Off : Text(text)
  }

let trimmed = (value: option<string>) =>
  value->Option.flatMap(text => {
    let text = text->String.trim
    text === "" ? None : Some(text)
  })

let defaultLabelBehavior: labelBehavior = #floating

let defaultErrorDisplayComposable: errorDisplay = #colorOnly
let defaultErrorDisplayReadyMade: errorDisplay = #inline
let defaultBrandIconMode: brandIconMode = #standard
let defaultCvcIcon: cvcIconDisplay = #default
let defaultUnstyled: bool = false

let resolveWith = (
  ~placeholder,
  ~label,
  ~labelBehavior,
  ~errorDisplay,
  ~accessibilityLabel,
  ~accessibilityHint,
  ~testID,
  ~unstyled,
  ~defaultAccessibilityLabel: string,
  ~defaultTestID: string,

  ~formWideUnstyled: bool,

  ~formWideErrorDisplay: errorDisplay,

  ~formWideLabelBehavior: labelBehavior,

  ~defaultPlaceholder: string,
  ~defaultLabel: string,
): resolved => {
  let unstyled = unstyled->Option.getOr(formWideUnstyled)

  let inherited = fallback => unstyled ? None : Some(fallback)
  let chrome = (explicit, fallback) => unstyled ? fallback : explicit->Option.getOr(fallback)

  {
    placeholder: unstyled
      ? None
      : switch merchantText(placeholder) {
        | Inherit => inherited(defaultPlaceholder)
        | Off => None
        | Text(text) => Some(text)
        },
    label: unstyled
      ? None
      : switch merchantText(label) {
        | Inherit => inherited(defaultLabel)
        | Off => None
        | Text(text) => Some(text)
        },
    labelBehavior: chrome(labelBehavior, unstyled ? #never : formWideLabelBehavior),
    errorDisplay: chrome(errorDisplay, unstyled ? #none : formWideErrorDisplay),
    accessibilityLabel: trimmed(accessibilityLabel)->Option.getOr(defaultAccessibilityLabel),
    accessibilityHint: trimmed(accessibilityHint),
    testID: trimmed(testID)->Option.getOr(defaultTestID),
    unstyled,
  }
}

let resolveField = (
  options: option<fieldOptions>,
  ~defaultAccessibilityLabel,
  ~defaultTestID,
  ~formWideUnstyled,
  ~formWideErrorDisplay,
  ~formWideLabelBehavior,
  ~defaultPlaceholder,
  ~defaultLabel,
) =>
  resolveWith(
    ~placeholder=options->Option.flatMap(o => o.placeholder),
    ~label=options->Option.flatMap(o => o.label),
    ~labelBehavior=options->Option.flatMap(o => o.labelBehavior),
    ~errorDisplay=options->Option.flatMap(o => o.errorDisplay),
    ~accessibilityLabel=options->Option.flatMap(o => o.accessibilityLabel),
    ~accessibilityHint=options->Option.flatMap(o => o.accessibilityHint),
    ~testID=options->Option.flatMap(o => o.testID),
    ~unstyled=options->Option.flatMap(o => o.unstyled),
    ~defaultAccessibilityLabel,
    ~defaultTestID,
    ~formWideUnstyled,
    ~formWideErrorDisplay,
    ~formWideLabelBehavior,
    ~defaultPlaceholder,
    ~defaultLabel,
  )

let resolveCardNumber = (
  options: option<cardNumberOptions>,
  ~formWideUnstyled,
  ~formWideErrorDisplay,
  ~formWideLabelBehavior,
  ~labels: CardFormTypes.cardLabels,
) =>
  resolveWith(
    ~placeholder=options->Option.flatMap(o => o.placeholder),
    ~label=options->Option.flatMap(o => o.label),
    ~labelBehavior=options->Option.flatMap(o => o.labelBehavior),
    ~errorDisplay=options->Option.flatMap(o => o.errorDisplay),
    ~accessibilityLabel=options->Option.flatMap(o => o.accessibilityLabel),
    ~accessibilityHint=options->Option.flatMap(o => o.accessibilityHint),
    ~testID=options->Option.flatMap(o => o.testID),
    ~unstyled=options->Option.flatMap(o => o.unstyled),
    ~defaultAccessibilityLabel="Card number",
    ~defaultTestID=CardTestIds.cardNumberInputTestId,
    ~formWideUnstyled,
    ~formWideErrorDisplay,
    ~formWideLabelBehavior,
    ~defaultPlaceholder=labels.cardNumberPlaceholder,
    ~defaultLabel=labels.cardNumberFloatingLabel,
  )

let resolveExpiry = (
  options: option<expiryOptions>,
  ~formWideUnstyled,
  ~formWideErrorDisplay,
  ~formWideLabelBehavior,
  ~labels: CardFormTypes.cardLabels,
) =>
  resolveField(
    options,
    ~defaultAccessibilityLabel="Expiration date",
    ~defaultTestID=CardTestIds.expiryInputTestId,
    ~formWideUnstyled,
    ~formWideErrorDisplay,
    ~formWideLabelBehavior,
    ~defaultPlaceholder=labels.expiryPlaceholder,
    ~defaultLabel=labels.expiryFloatingLabel,
  )

let resolveCardholderName = (
  options: option<cardholderNameOptions>,
  ~formWideUnstyled,
  ~formWideErrorDisplay,
  ~formWideLabelBehavior,
  ~labels: CardFormTypes.cardLabels,
) =>
  resolveField(
    options,
    ~defaultAccessibilityLabel="Cardholder name",
    ~defaultTestID=CardTestIds.cardholderNameInputTestId,
    ~formWideUnstyled,
    ~formWideErrorDisplay,
    ~formWideLabelBehavior,
    ~defaultPlaceholder=labels.cardholderNamePlaceholder,
    ~defaultLabel=labels.cardholderNameFloatingLabel,
  )

let resolveCvc = (
  options: option<cvcOptions>,
  ~formWideUnstyled,
  ~formWideErrorDisplay,
  ~formWideLabelBehavior,
  ~labels: CardFormTypes.cardLabels,
) =>
  resolveWith(
    ~placeholder=options->Option.flatMap(o => o.placeholder),
    ~label=options->Option.flatMap(o => o.label),
    ~labelBehavior=options->Option.flatMap(o => o.labelBehavior),
    ~errorDisplay=options->Option.flatMap(o => o.errorDisplay),
    ~accessibilityLabel=options->Option.flatMap(o => o.accessibilityLabel),
    ~accessibilityHint=options->Option.flatMap(o => o.accessibilityHint),
    ~testID=options->Option.flatMap(o => o.testID),
    ~unstyled=options->Option.flatMap(o => o.unstyled),
    ~defaultAccessibilityLabel="Security code",
    ~defaultTestID=CardTestIds.cvcInputTestId,
    ~formWideUnstyled,
    ~formWideErrorDisplay,
    ~formWideLabelBehavior,
    ~defaultPlaceholder=labels.cvcPlaceholder,
    ~defaultLabel=labels.cvcFloatingLabel,
  )

let resolveBrandIconMode = (
  options: option<cardNumberOptions>,
  ~formWide: brandIconMode,
  ~unstyled: bool,
): brandIconMode =>
  unstyled ? #hidden : options->Option.flatMap(o => o.cardBrandIcon)->Option.getOr(formWide)

let cvcIconOf = (options: option<cvcOptions>, ~unstyled: bool) =>
  unstyled ? #hidden : options->Option.flatMap(o => o.cvcIcon)->Option.getOr(defaultCvcIcon)

let unstyledFor = (fieldUnstyled: option<bool>, ~formWide: bool) =>
  fieldUnstyled->Option.getOr(formWide)

let cardNumberOf = (options: option<formFieldOptions>) =>
  options->Option.flatMap(o => o.cardNumber)

let cardExpiryOf = (options: option<formFieldOptions>) => options->Option.flatMap(o => o.cardExpiry)

let cardCvcOf = (options: option<formFieldOptions>) => options->Option.flatMap(o => o.cardCvc)

let cardholderNameOf = (options: option<formFieldOptions>) =>
  options->Option.flatMap(o => o.cardholderName)
