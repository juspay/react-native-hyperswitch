/*
 * The native view that shows one card field from the vault's own engine. Read by Codegen when the
 * merchant's app is built. The vault's JavaScript does not import this file: it registers the same
 * view by name with a hand-written view config (src/native/fieldView.mjs), which must list the
 * same props and the same event.
 */
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { ViewProps } from 'react-native';
import type { DirectEventHandler } from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  formId: string;
  elementType: string;
  /* The field's data props, as JSON text. */
  settings?: string;
  onFieldEvent?: DirectEventHandler<{
    name: string;
    payload: string;
  }>;
}

export default codegenNativeComponent<NativeProps>('HyperswitchVaultFieldView', {
  excludedPlatforms: ['iOS'],
});
