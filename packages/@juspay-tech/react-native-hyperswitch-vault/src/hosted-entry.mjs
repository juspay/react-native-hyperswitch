/*
 * The entry of the vault's hosted bundle (hyperswitch-vault-fields.bundle): the only JavaScript the
 * vault's own engine runs. The vault's native host loads the bundle, then starts the two roots
 * registered below by name.
 *
 * NOT A PACKAGE ENTRY. No `exports` path leads here and no merchant code imports it. It is built by
 * rollup into bundle/build/ and from there into the bundle by bundle/build.mjs.
 */
import { AppRegistry, TurboModuleRegistry } from 'react-native';
import { silenceConsole } from './hosted/quiet.mjs';
import {
  FIELD_ROOT,
  FORM_ROOT,
  NATIVE_MODULE,
  SDK_ENGINE_FLAG,
  getForm,
  makeBridge,
  makeRoots,
  startCommands,
} from './hosted/index.mjs';

/* Before any root starts: React Native logs every prop update, and the props carry the settings. */
silenceConsole();

/*
 * Read by the vault's root components when they render: inside an SDK's own engine they always
 * take the plain JavaScript path. Set before any root can render.
 */
globalThis[SDK_ENGINE_FLAG] = true;

const bridge = makeBridge(TurboModuleRegistry.get(NATIVE_MODULE));
const { FormRoot, FieldRoot } = makeRoots(bridge);

AppRegistry.registerComponent(FORM_ROOT, () => FormRoot);
AppRegistry.registerComponent(FIELD_ROOT, () => FieldRoot);
startCommands(bridge, getForm);
