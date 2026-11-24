/*
 * The native view for one field, as the merchant's engine sees it: three props and one event.
 *
 * WHY BY HAND. React Native normally builds this view config from the Codegen spec
 * (src/specs/HyperswitchVaultFieldViewNativeComponent.ts) with a Babel plugin that runs when the
 * APP is built. This package ships JavaScript that is already built, so the plugin never sees it.
 * The config below is what the plugin would have produced. It must list the same props and the
 * same event as the spec and as the native view manager.
 */
import * as NativeComponentRegistry from 'react-native/Libraries/NativeComponent/NativeComponentRegistry';
import { ConditionallyIgnoredEventHandlers } from 'react-native/Libraries/NativeComponent/ViewConfigIgnore';
import { FIELD_VIEW } from '../hosted/protocol.mjs';

export const VaultFieldView = NativeComponentRegistry.get(FIELD_VIEW, () => ({
  uiViewClassName: FIELD_VIEW,
  directEventTypes: {
    topFieldEvent: { registrationName: 'onFieldEvent' },
  },
  validAttributes: {
    formId: true,
    elementType: true,
    settings: true,
    ...ConditionallyIgnoredEventHandlers({ onFieldEvent: true }),
  },
}));
