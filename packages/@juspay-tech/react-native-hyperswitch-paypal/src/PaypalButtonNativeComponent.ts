// Deep imports keep the compiled output loadable on old-architecture React
// Native consumers down to 0.72, where the root exports for
// codegenNativeComponent/CodegenTypes do not exist at runtime.
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type {Double} from 'react-native/Libraries/Types/CodegenTypes';
import type {HostComponent, ViewProps} from 'react-native';

export interface NativeProps extends ViewProps {
  buttonColor?: string;
  buttonLabel?: string;
  buttonSize?: string;
  borderRadius?: Double;
}

// codegenNativeComponent works on both architectures: static view config +
// Fabric on the new architecture, Paper view config lookup on the old one.
export default codegenNativeComponent<NativeProps>(
  'PaypalButton'
) as HostComponent<NativeProps>;
