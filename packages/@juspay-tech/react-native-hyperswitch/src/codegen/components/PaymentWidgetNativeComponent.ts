import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { ViewProps } from 'react-native';
import type {
  DirectEventHandler,
  Int32,
  UnsafeMixed,
} from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  widgetType?: string;
  sdkAuthorization?: string;
  // Pass-through configuration object (matches Android's ReadableMap → setConfiguration).
  // UnsafeMixed maps to folly::dynamic on iOS and ReadableMap on Android.
  options?: UnsafeMixed;
  // Both events carry the SAME envelope on iOS and Android:
  //   { "eventName": "<type>", "payload": "<raw-json-string>" }
  onPaymentResult?: DirectEventHandler<{
    eventName: string;
    payload: string;
  }>;
  onPaymentEvent?: DirectEventHandler<{
    eventName: string;
    payload: string;
  }>;
  // A tapped payment method message action; separate from payment events.
  onMessageAction?: DirectEventHandler<{
    paymentMethod: string;
    paymentMethodType: string;
    index: Int32;
    text: string;
  }>;
}

export default codegenNativeComponent<NativeProps>('RCTNativePaymentWidget');
