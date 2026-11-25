/*
 * The native module the MERCHANT's engine talks to: it opens, updates and closes card forms in the
 * vault's own engine, and carries commands to them.
 *
 * This file is read by React Native's Codegen when the merchant's app is built, to generate the
 * native interface. The vault's JavaScript does not import it: it finds the module by name
 * ('HyperswitchVaultForms'), so the package's built JavaScript needs no build step in the app.
 *
 * `settings` and every `payload` are JSON text. One string is the same on every React Native
 * version, where a typed object is not.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { EventEmitter, Int32 } from 'react-native/Libraries/Types/CodegenTypes';

export type VaultFormEvent = {
  formId: string;
  name: string;
  payload: string;
};

export interface Spec extends TurboModule {
  /* Read once, to decide whether the native path can run in this app. */
  getConstants(): {
    newArchitecture: boolean;
    reactNativeMinor: Int32;
    protocolVersion: Int32;
    bundled: boolean;
  };
  openForm(formId: string, settings: string): void;
  updateForm(formId: string, settings: string): void;
  closeForm(formId: string): void;
  /* Always resolves, never rejects: with the command's result as JSON text. */
  sendCommand(formId: string, name: string, elementType: string): Promise<string>;
  readonly onFormEvent: EventEmitter<VaultFormEvent>;
}

export default TurboModuleRegistry.get<Spec>('HyperswitchVaultForms');
