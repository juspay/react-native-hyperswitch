import type {
  ApplePayButtonStyle,
  ApplePayButtonType,
  ApplePayConfiguration,
  GooglePayButtonStyle,
  GooglePayButtonType,
  GooglePayConfiguration,
  PaymentSheetConfiguration,
} from '../types/PaymentSheetConfiguration';

const GOOGLE_PAY_BUTTON_TYPE: Record<GooglePayButtonType, number> = {
  BUY: 1,
  BOOK: 6,
  CHECKOUT: 5,
  DONATE: 4,
  ORDER: 11,
  PAY: 1000,
  SUBSCRIBE: 7,
  PLAIN: 1001,
};

const GOOGLE_PAY_APPEARANCE: Record<GooglePayButtonStyle, number> = {
  light: 1,
  dark: 2,
};

const APPLE_PAY_BUTTON_TYPE: Record<ApplePayButtonType, number> = {
  plain: 0,
  buy: 1,
  setUp: 2,
  inStore: 3,
  donate: 4,
  checkout: 5,
  book: 6,
  subscribe: 7,
};

const APPLE_PAY_BUTTON_STYLE: Record<ApplePayButtonStyle, number> = {
  white: 0,
  whiteOutline: 1,
  black: 2,
};

export function isHidden(
  config?: GooglePayConfiguration | ApplePayConfiguration
): boolean {
  return config?.visibility === 'hidden';
}

export function getBorderRadius(options?: PaymentSheetConfiguration): number {
  return (
    options?.appearance?.primaryButton?.shapes?.borderRadius ??
    options?.appearance?.shapes?.borderRadius ??
    4
  );
}

function isDarkTheme(
  options: PaymentSheetConfiguration | undefined,
  colorScheme: 'light' | 'dark'
): boolean {
  const theme = options?.appearance?.theme;
  if (theme === 'Dark') {
    return true;
  }
  if (theme === 'Light') {
    return false;
  }
  return colorScheme === 'dark';
}

export function resolveGooglePayProps(
  options: PaymentSheetConfiguration | undefined,
  colorScheme: 'light' | 'dark'
) {
  const config = options?.walletButtonsConfiguration?.googlePay;
  const dark = isDarkTheme(options, colorScheme);
  const style = dark ? config?.buttonStyle?.dark : config?.buttonStyle?.light;

  return {
    hidden: isHidden(config),
    type: GOOGLE_PAY_BUTTON_TYPE[config?.buttonType ?? 'PLAIN'],
    appearance: GOOGLE_PAY_APPEARANCE[style ?? (dark ? 'dark' : 'light')],
    borderRadius: getBorderRadius(options),
  };
}

export function resolveApplePayProps(
  options: PaymentSheetConfiguration | undefined,
  colorScheme: 'light' | 'dark'
) {
  const config = options?.walletButtonsConfiguration?.applePay;
  const dark = isDarkTheme(options, colorScheme);
  const style = dark ? config?.buttonStyle?.dark : config?.buttonStyle?.light;

  return {
    hidden: isHidden(config),
    type: APPLE_PAY_BUTTON_TYPE[config?.buttonType ?? 'plain'],
    buttonStyle: APPLE_PAY_BUTTON_STYLE[style ?? (dark ? 'white' : 'black')],
    borderRadius: getBorderRadius(options),
  };
}
