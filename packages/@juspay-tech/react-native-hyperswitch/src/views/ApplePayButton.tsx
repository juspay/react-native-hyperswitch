import {
  Platform,
  Pressable,
  StyleSheet,
  requireNativeComponent,
  useColorScheme,
} from 'react-native';
import type { ViewProps, ViewStyle } from 'react-native';
import { useWalletLaunch } from './useWalletLaunch';
import { useWalletReady } from './useWalletReady';
import { resolveApplePayProps } from './walletButtonConfig';
import type { PaymentSession } from '../types/definitions';
import type { PaymentResult } from '../types/paymentresult';
import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';

declare global {
  var nativeFabricUIManager: unknown | null | undefined;
}

type NativeProps = ViewProps & {
  type?: number;
  buttonStyle?: number;
  buttonBorderRadius?: number;
  disabled?: boolean;
};

function resolveNativeComponent(): React.ComponentType<NativeProps> | null {
  if (Platform.OS !== 'ios') {
    return null;
  }
  try {
    if (globalThis.nativeFabricUIManager != null) {
      return require('../codegen/components/HyperApplePayNativeComponent')
        .default as React.ComponentType<NativeProps>;
    }
    return requireNativeComponent(
      'HyperApplePayButton'
    ) as unknown as React.ComponentType<NativeProps>;
  } catch {
    return null;
  }
}

const NativeHyperApplePayButton = resolveNativeComponent();

export type ApplePayButtonProps = {
  options?: PaymentSheetConfiguration;
  session?: PaymentSession;
  onPaymentResult?: (result: PaymentResult) => void;
  onReady?: () => void;
  onLoadError?: (error: PaymentResult) => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function ApplePayButton({
  options,
  session,
  onPaymentResult,
  onReady,
  onLoadError,
  disabled = false,
  style,
}: ApplePayButtonProps) {
  const colorScheme = useColorScheme();
  const launch = useWalletLaunch({
    wallet: 'apple_pay',
    label: 'Apple Pay',
    session,
    onPaymentResult,
  });

  useWalletReady({
    wallet: 'apple_pay',
    label: 'Apple Pay',
    session,
    onReady,
    onLoadError,
  });

  const { hidden, type, buttonStyle, borderRadius } = resolveApplePayProps(
    options,
    colorScheme === 'dark' ? 'dark' : 'light'
  );

  if (hidden || NativeHyperApplePayButton == null) {
    return null;
  }

  return (
    <Pressable
      focusable
      accessible
      accessibilityRole="button"
      accessibilityLabel="Apple Pay"
      onPress={launch}
      disabled={disabled}
      style={style}
    >
      <NativeHyperApplePayButton
        type={type}
        buttonStyle={buttonStyle}
        buttonBorderRadius={borderRadius}
        disabled={disabled}
        style={StyleSheet.absoluteFill}
      />
    </Pressable>
  );
}
