/*
 * The native module the vault's OWN engine talks to (src/hosted/bridge.mjs). It exists only in that
 * engine: the merchant's engine never has it. Events go out through it, and commands come in.
 *
 * `rootTag` is the tag of the React root the event comes from, or the command goes to. Native code
 * finds the owner of that root by it.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { EventEmitter, Int32 } from 'react-native/Libraries/Types/CodegenTypes';

export type VaultCommand = {
  rootTag: Int32;
  formId: string;
  commandId: string;
  name: string;
  elementType?: string;
};

export interface Spec extends TurboModule {
  emitFieldEvent(rootTag: Int32, eventName: string, payload: string): void;
  emitFormEvent(rootTag: Int32, eventName: string, payload: string): void;
  readonly onCommand: EventEmitter<VaultCommand>;
}

export default TurboModuleRegistry.get<Spec>('HyperswitchVaultHosted');
