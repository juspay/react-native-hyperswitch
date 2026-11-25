/*
 * The native view for one field, as the merchant's engine sees it: three props and one event.
 *
 * WHY BY HAND. React Native normally builds this view config from the Codegen spec
 * (src/specs/HyperswitchVaultFieldViewNativeComponent.ts) with a Babel plugin that runs when the
 * APP is built. This package ships JavaScript that is already built, so the plugin never sees it.
 * The config below is what the plugin would have produced. It must list the same props and the
 * same event as the spec and as the native view manager.
 *
 * LOADED ONLY ON THE NATIVE PATH. The two React Native files below are internals reached by path.
 * Imported at the top, they would run in every app that imports the vault's root, and on the web
 * (hyperswitch-client-core bundles the vault for a browser) they throw while loading, before any
 * check can run. So they are required the first time a native field renders, which happens only
 * after availability.mjs has chosen the native path. (src/ScanCardBridge.res requires an optional
 * package the same way.)
 */
import { FIELD_VIEW } from '../hosted/protocol.mjs';

let view = null;

/* The registered view component. Registered once: React Native refuses a name registered twice. */
export function vaultFieldView() {
  if (view === null) {
    const NativeComponentRegistry = require('react-native/Libraries/NativeComponent/NativeComponentRegistry');
    const { ConditionallyIgnoredEventHandlers } = require('react-native/Libraries/NativeComponent/ViewConfigIgnore');
    view = NativeComponentRegistry.get(FIELD_VIEW, () => ({
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
  }
  return view;
}
