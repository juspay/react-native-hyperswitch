/*
 * Can the native path run here? Asked once per engine, by the first card form that renders.
 *
 * The native path means: each field is a native view whose content runs in the vault's own
 * JavaScript engine. It runs only when ALL of these hold; in every other case the fields render in
 * plain JavaScript, exactly as they did before there was a native path.
 *
 *   1. This is not an SDK's own engine. Inside one (the vault's hosted bundle, or a checkout SDK's
 *      bundle that includes the vault) the fields must be the plain ones: an engine must never try
 *      to start another engine.
 *   2. The app was built with the vault's native code. An app that was not rebuilt, an
 *      over-the-air JavaScript update on an older build, Expo Go and unit tests have no module.
 *   3. The new architecture is on. There is no native path for the old one.
 *   4. The app's build carries the bundle.
 *   5. The native code speaks this JavaScript's protocol version. (An over-the-air update can make
 *      this JavaScript newer than the app it runs in.)
 *   6. The app's React Native version is one the bundle was tested on.
 *
 * Returns the forms module when the answer is yes, else null.
 */
import { TurboModuleRegistry } from 'react-native';
import { FORMS_MODULE, SDK_ENGINE_FLAG } from '../hosted/protocol.mjs';
import { supports } from './rule.mjs';

let decided;

export function nativeForms() {
  if (decided !== undefined) return decided;
  decided = null;
  try {
    if (globalThis[SDK_ENGINE_FLAG] === true) return decided;
    const forms = TurboModuleRegistry.get(FORMS_MODULE);
    if (forms && supports(forms.getConstants())) decided = forms;
  } catch {
    /* Anything unexpected from the native side means: not here. The plain path always works. */
    decided = null;
  }
  return decided;
}
