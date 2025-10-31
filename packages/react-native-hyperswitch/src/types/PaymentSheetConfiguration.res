type localeTypes =
  | En
  | He
  | Fr
  | En_GB
  | Ar
  | Ja
  | De
  | Fr_BE
  | Es
  | Ca
  | Pt
  | It
  | Pl
  | Nl
  | NI_BE
  | Sv
  | Ru
  | Lt
  | Cs
  | Sk
  | Ls
  | Cy
  | El
  | Et
  | Fi
  | Nb
  | Bs
  | Da
  | Ms
  | Tr_CY

type fontFamilyTypes = DefaultIOS | DefaultAndroid | CustomFont(string) | DefaultWeb

type placeholder = {
  cardNumber?: string,
  expiryDate?: string,
  cvv?: string,
}

type address = {
  first_name?: string,
  last_name?: string,
  city?: string,
  country?: string,
  line1?: string,
  line2?: string,
  zip?: string,
  state?: string,
}

type phone = {
  number?: string,
  country_code?: string,
}

type addressDetails = {
  address?: address,
  email?: string,
  phone?: phone,
}

type customerConfiguration = {
  id?: string,
  ephemeralKeySecret?: string,
}

type colors = {
  primary?: string,
  background?: string,
  componentBackground?: string,
  componentBorder?: string,
  componentDivider?: string,
  componentText?: string,
  primaryText?: string,
  secondaryText?: string,
  placeholderText?: string,
  icon?: string,
  error?: string,
  loaderBackground?: string,
  loaderForeground?: string,
}

type colorType = {
  light?: colors,
  dark?: colors,
}

// IOS Specific
type offsetType = {
  x?: float,
  y?: float,
}
type shadowConfig = {
  color?: string,
  opacity?: float,
  blurRadius?: float,
  offset?: offsetType,
  intensity?: float,
}

type shapes = {
  borderRadius?: float,
  borderWidth?: float,
  shadow?: shadowConfig, // IOS Specific
}

type font = {
  family?: fontFamilyTypes,
  scale?: float,
  headingTextSizeAdjust?: float,
  subHeadingTextSizeAdjust?: float,
  placeholderTextSizeAdjust?: float,
  buttonTextSizeAdjust?: float,
  errorTextSizeAdjust?: float,
  linkTextSizeAdjust?: float,
  modalTextSizeAdjust?: float,
  cardTextSizeAdjust?: float,
}

type primaryButtonColor = {
  background?: string,
  text?: string,
  border?: string,
}
type primaryButtonColorType = {
  light?: primaryButtonColor, 
  dark?: primaryButtonColor
}

type primaryButton = {
  shapes?: shapes,
  primaryButtonColor?: primaryButtonColorType,
}

type googlePayButtonType = BUY | BOOK | CHECKOUT | DONATE | ORDER | PAY | SUBSCRIBE | PLAIN

type googlePayButtonStyle = [#light | #dark]

type googlePayThemeBaseStyle = {
  light?: googlePayButtonStyle,
  dark?: googlePayButtonStyle,
}

type googlePayConfiguration = {
  buttonType?: googlePayButtonType,
  buttonStyle?: googlePayThemeBaseStyle,
}

type applePayButtonType = [
  | #buy
  | #setUp
  | #inStore
  | #donate
  | #checkout
  | #book
  | #subscribe
  | #plain
]
type applePayButtonStyle = [#white | #whiteOutline | #black]

type applePayThemeBaseStyle = {
  light?: applePayButtonStyle,
  dark?: applePayButtonStyle,
}

type applePayConfiguration = {
  buttonType?: applePayButtonType,
  buttonStyle?: applePayThemeBaseStyle,
}

type themeType =
  | Default
  | Light
  | Dark
  | Minimal
  | FlatMinimal

type layoutType = [#tabs | #accordion | #spacedAccordion]

type appearance = {
  locale?: localeTypes,
  colors?: colorType,
  shapes?: shapes,
  font?: font,
  primaryButton?: primaryButton,
  googlePay?: googlePayConfiguration,
  applePay?: applePayConfiguration,
  theme?: themeType,
  layout?: layoutType,
}

@genType
type options = {
  allowsDelayedPaymentMethods?: bool,
  appearance?: appearance,
  shippingDetails?: addressDetails,
  primaryButtonLabel?: string,
  paymentSheetHeaderText?: string,
  savedPaymentScreenHeaderText?: string,
  merchantDisplayName?: string,
  defaultBillingDetails?: addressDetails,
  primaryButtonColor?: string,
  allowsPaymentMethodsRequiringShippingAddress?: bool,
  displaySavedPaymentMethodsCheckbox?: bool,
  displaySavedPaymentMethods?: bool,
  placeholder?: placeholder,
  defaultView?: bool,
  netceteraSDKApiKey?: string,
  displayDefaultSavedPaymentIcon?: bool,
  enablePartialLoading?: bool,
  customer?: customerConfiguration,
  paymentSheetHeaderLabel?: string,
  savedPaymentSheetHeaderLabel?: string,
}
