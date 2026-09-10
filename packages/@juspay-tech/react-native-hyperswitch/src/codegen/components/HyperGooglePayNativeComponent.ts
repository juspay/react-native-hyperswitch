import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { ViewProps } from 'react-native';
import type {
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  type?: WithDefault<Int32, -1>;
  appearance: Int32;
  borderRadius?: Int32;
}

export default codegenNativeComponent<NativeProps>('HyperGooglePayButton', {
  excludedPlatforms: ['iOS'],
});
