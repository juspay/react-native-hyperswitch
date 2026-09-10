import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { ViewProps } from 'react-native';
import type {
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  type?: WithDefault<Int32, 0>;
  buttonStyle?: WithDefault<Int32, 2>;
  buttonBorderRadius?: WithDefault<Int32, 4>;
  disabled?: WithDefault<boolean, false>;
}

export default codegenNativeComponent<NativeProps>('HyperApplePayButton', {
  excludedPlatforms: ['android'],
});
