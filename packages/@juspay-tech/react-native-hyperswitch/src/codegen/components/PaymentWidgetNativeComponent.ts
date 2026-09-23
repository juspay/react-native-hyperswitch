import { codegenNativeComponent } from 'react-native';
import type { ViewProps } from 'react-native';
import type {
  DirectEventHandler,
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
}

export default codegenNativeComponent<NativeProps>('RCTNativePaymentWidget');
