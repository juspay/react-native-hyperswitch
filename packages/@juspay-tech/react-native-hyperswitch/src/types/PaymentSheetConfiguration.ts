import { HyperswitchConfiguration } from './definitions';

export interface Colors {
  primary?: string;
  background?: string;
  componentBackground?: string;
  componentBorder?: string;
  componentDivider?: string;
  componentText?: string;
  primaryText?: string;
  secondaryText?: string;
  placeholderText?: string;
  icon?: string;
  error?: string;
  loaderBackground?: string;
  loaderForeground?: string;
  overlay?: string;
  selectedComponentBackground?: string;
  selectedComponentBorder?: string;
  selectedComponentBorderWidth?: number;
  selectedComponentDivider?: string;
  selectedComponentText?: string;
}

export interface ColorType {
  light?: Colors;
  dark?: Colors;
}

export interface OffsetType {
  x?: number;
  y?: number;
}

export interface ShadowConfig {
  color?: string;
  opacity?: number;
  blurRadius?: number;
  offset?: OffsetType;
  intensity?: number;
}

export interface Shapes {
  borderRadius?: number;
  borderWidth?: number;
  shadow?: ShadowConfig;
  inputHeight?: number;
  gap?: number;
}

export interface Font {
  family?: string;
  scale?: number;
  headingTextSizeAdjust?: number;
  subHeadingTextSizeAdjust?: number;
  placeholderTextSizeAdjust?: number;
  buttonTextSizeAdjust?: number;
  errorTextSizeAdjust?: number;
  linkTextSizeAdjust?: number;
  modalTextSizeAdjust?: number;
  cardTextSizeAdjust?: number;
}

export type SubscriptionEvent =
  | 'cardDetailsChange'
  | 'paymentMethodChange'
  | 'formStatusChange'
  | 'billingDetailsChange'
  | 'cvcStatusChange'
  | 'surchargeInfo'
  | 'appliedOffersInfo';

export type Theme =
  | 'Default'
  | 'Light'
  | 'Dark'
  | 'Minimal'
  | 'FlatMinimal'
  | 'Brutal'
  | 'Glass'
  | 'Skeu'
  | 'Clay'
  | 'Charcoal'
  | 'Soft';

export type LayoutType = 'tabs' | 'accordion' | 'spacedAccordion';
export type PaymentMethodsArrangement = 'default' | 'grid';
export type RedirectionInfo = 'hidden' | 'shown';
export type CvcIconDisplay = 'shown' | 'hidden';

export interface GroupingBehavior {
  displayInSeparateScreen?: boolean;
  displayInSeparateSection?: boolean;
  groupByPaymentMethods?: boolean;
}

export interface SavedMethodCustomization {
  defaultCollapsed?: boolean;
  hideCardExpiry?: boolean;
  hideCVCError?: boolean;
  cvcIcon?: CvcIconDisplay;
  groupingBehavior?: GroupingBehavior;
  hiddenPaymentMethods?: string[];
}

export type CardBrandIconDisplay =
  'hidden' | 'animated' | 'standard' | 'hideGeneric';

export interface PaymentMethodLayout {
  type?: LayoutType;
  showOneClickWalletsOnTop?: boolean;
  paymentMethodsArrangementForTabs?: PaymentMethodsArrangement;
  defaultCollapsed?: boolean;
  radios?: boolean;
  spacedAccordionItems?: boolean;
  maxAccordionItems?: number;
  cvcIcon?: CvcIconDisplay;
  cardBrandIcon?: CardBrandIconDisplay;
  showCheckedIconForSelection?: boolean;
  separatorText?: string;
  savedMethodCustomization?: SavedMethodCustomization;
}

export interface PrimaryButtonColors {
  background?: string;
  text?: string;
  border?: string;
}

export interface PrimaryButtonColorType {
  light?: PrimaryButtonColors;
  dark?: PrimaryButtonColors;
}

export interface PrimaryButton {
  shapes?: Shapes;
  colors?: PrimaryButtonColorType;
  height?: number;
}

export type GooglePayButtonType =
  | 'BUY'
  | 'BOOK'
  | 'CHECKOUT'
  | 'DONATE'
  | 'ORDER'
  | 'PAY'
  | 'SUBSCRIBE'
  | 'PLAIN';

export type GooglePayButtonStyle = 'light' | 'dark';

export interface GooglePayThemeBaseStyle {
  light?: GooglePayButtonStyle;
  dark?: GooglePayButtonStyle;
}

export interface GooglePayConfiguration {
  visibility?: 'hidden' | 'shown';
  buttonType?: GooglePayButtonType;
  buttonStyle?: GooglePayThemeBaseStyle;
}

export type ApplePayButtonType =
  | 'buy'
  | 'setUp'
  | 'inStore'
  | 'donate'
  | 'checkout'
  | 'book'
  | 'subscribe'
  | 'plain';

export type ApplePayButtonStyle = 'white' | 'whiteOutline' | 'black';

export interface ApplePayThemeBaseStyle {
  light?: ApplePayButtonStyle;
  dark?: ApplePayButtonStyle;
}

export interface ApplePayConfiguration {
  visibility?: 'hidden' | 'shown';
  buttonType?: ApplePayButtonType;
  buttonStyle?: ApplePayThemeBaseStyle;
}

export type PayPalButtonType = 'paypal' | 'checkout' | 'buynow' | 'pay';
export type PayPalButtonStyle = 'gold' | 'blue' | 'white' | 'black' | 'silver';
export type PayPalButtonSize = 'small' | 'medium' | 'large';

export interface PayPalThemeBaseStyle {
  light?: PayPalButtonStyle;
  dark?: PayPalButtonStyle;
}

export interface PayPalConfiguration {
  visibility?: 'hidden' | 'shown';
  buttonType?: PayPalButtonType;
  buttonSize?: PayPalButtonSize;
  buttonStyle?: PayPalThemeBaseStyle;
}

export interface WalletButtonsConfiguration {
  googlePay?: GooglePayConfiguration;
  applePay?: ApplePayConfiguration;
  payPal?: PayPalConfiguration;
}

export interface LogoColors {
  backgroundColor?: string;
  selected?: string;
  unselected?: string;
}

export interface LogoColorType {
  light?: LogoColors;
  dark?: LogoColors;
}

export interface CheckedIconColors {
  color?: string;
  stroke?: string;
}

export interface CheckedIconColorType {
  light?: CheckedIconColors;
  dark?: CheckedIconColors;
}

export interface CheckedIconForSelection {
  colors?: CheckedIconColorType;
  size?: number;
  bottom?: number;
  right?: number;
}

export interface LogoCustomization {
  borderRadius?: number;
  colors?: LogoColorType;
  checkedIconForSelection?: CheckedIconForSelection;
}

export interface Appearance {
  theme?: Theme;
  colors?: ColorType;
  shapes?: Shapes;
  font?: Font;
  primaryButton?: PrimaryButton;
  logo?: LogoCustomization;
}

export interface Placeholder {
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;
}

export interface Address {
  first_name?: string;
  last_name?: string;
  city?: string;
  country?: string;
  line1?: string;
  line2?: string;
  line3?: string;
  postalCode?: string;
  state?: string;
}

export interface Phone {
  number?: string;
  code?: string;
}

export interface AddressDetails {
  address?: Address;
  email?: string;
  phone?: Phone;
}

export interface CustomerConfiguration {
  id?: string;
  ephemeralKeySecret?: string;
}

export interface PaymentMethodConfig {
  paymentMethod: string;
  message?: string;
}

export type Locale =
  | 'en'
  | 'he'
  | 'fr'
  | 'en-GB'
  | 'ar'
  | 'ja'
  | 'de'
  | 'fr-BE'
  | 'es'
  | 'ca'
  | 'pt'
  | 'it'
  | 'pl'
  | 'nl'
  | 'nI-BE'
  | 'sv'
  | 'ru'
  | 'lt'
  | 'cs'
  | 'sk'
  | 'ls'
  | 'cy'
  | 'el'
  | 'et'
  | 'fi'
  | 'nb'
  | 'bs'
  | 'da'
  | 'ms'
  | 'tr-CY';

export interface PaymentSheetConfiguration {
  appearance?: Appearance;
  merchantDisplayName?: string;
  allowsDelayedPaymentMethods?: boolean;
  allowsPaymentMethodsRequiringShippingAddress?: boolean;
  displaySavedPaymentMethodsCheckbox?: boolean;
  displaySavedPaymentMethods?: boolean;
  displayDefaultSavedPaymentIcon?: boolean;
  displayPayButton?: boolean;
  stickyPayButton?: boolean;
  disableBranding?: boolean;
  preloadCardElement?: boolean;
  primaryButtonLabel?: string;
  paymentSheetHeaderLabel?: string;
  savedPaymentSheetHeaderLabel?: string;
  netceteraSDKApiKey?: string;
  locale?: Locale;
  subscribedEvents?: SubscriptionEvent[];
  customer?: CustomerConfiguration;
  placeholder?: Placeholder;
  billingDetails?: AddressDetails;
  shippingDetails?: AddressDetails;
  walletButtonsConfiguration?: WalletButtonsConfiguration;
  redirectionInfo?: RedirectionInfo;
  alwaysSendCustomerAcceptance?: boolean;
  paymentMethodsConfig?: PaymentMethodConfig[];
  opensCardScannerAutomatically?: boolean;
  paymentMethodOrder?: string[];
  paymentMethodLayout?: PaymentMethodLayout;
  splitCardFields?: boolean;
  hideCardNicknameField?: boolean;
}

export interface options {
  hyperswitchConfig?: HyperswitchConfiguration;
  paymentSessionConfig?: { sdkAuthorization: string };
  configuration?: PaymentSheetConfiguration;
}
