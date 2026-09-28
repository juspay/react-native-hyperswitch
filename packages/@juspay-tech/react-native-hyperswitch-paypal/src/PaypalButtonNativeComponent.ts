// Deep imports keep the spec loadable on React Native versions that predate
// the root exports for codegenNativeComponent/CodegenTypes.
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { Double } from 'react-native/Libraries/Types/CodegenTypes';
import type { HostComponent, ViewProps } from 'react-native';

export interface NativeProps extends ViewProps {
  buttonColor?: string;
  buttonLabel?: string;
  buttonSize?: string;
  borderRadius?: Double;
}

export default codegenNativeComponent<NativeProps>(
  'PaypalButton'
) as HostComponent<NativeProps>;
