import {
  Platform,
  Pressable,
  StyleSheet,
  requireNativeComponent,
  useColorScheme,
} from 'react-native';
import type { ViewProps, ViewStyle } from 'react-native';
import { useWalletLaunch } from './useWalletLaunch';
import { resolveGooglePayProps } from './walletButtonConfig';
import type { PaymentSession } from '../types/definitions';
import type { PaymentResult } from '../types/paymentresult';
import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';

declare global {
  var nativeFabricUIManager: unknown | null | undefined;
}

type NativeProps = ViewProps & {
  type?: number;
  appearance: number;
  borderRadius?: number;
};

function resolveNativeComponent(): React.ComponentType<NativeProps> | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    if (globalThis.nativeFabricUIManager != null) {
      return require('../codegen/components/HyperGooglePayNativeComponent')
        .default as React.ComponentType<NativeProps>;
    }
    return requireNativeComponent(
      'HyperGooglePayButton'
    ) as unknown as React.ComponentType<NativeProps>;
  } catch {
    return null;
  }
}

const NativeHyperGooglePayButton = resolveNativeComponent();

export type GooglePayButtonProps = {
  options?: PaymentSheetConfiguration;
  session?: PaymentSession;
  onPaymentResult?: (result: PaymentResult) => void;
  style?: ViewStyle;
};

export function GooglePayButton({
  options,
  session,
  onPaymentResult,
  style,
}: GooglePayButtonProps) {
  const colorScheme = useColorScheme();
  const launch = useWalletLaunch({
    wallet: 'google_pay',
    label: 'Google Pay',
    session,
    onPaymentResult,
  });

  const { hidden, type, appearance, borderRadius } = resolveGooglePayProps(
    options,
    colorScheme === 'dark' ? 'dark' : 'light'
  );

  if (hidden || NativeHyperGooglePayButton == null) {
    return null;
  }

  return (
    <Pressable
      focusable
      accessible
      accessibilityRole="button"
      accessibilityLabel="Google Pay"
      onPress={launch}
      style={style}
    >
      <NativeHyperGooglePayButton
        type={type}
        appearance={appearance}
        borderRadius={borderRadius}
        style={StyleSheet.absoluteFill}
      />
    </Pressable>
  );
}
