import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  confirmPayment(reactTag: number, callback: (result: string) => void): void;
  updateIntentInitForWidget(
    reactTag: number,
    callback: (result: string) => void
  ): void;
  updateIntentCompleteForWidget(
    reactTag: number,
    sdkAuthorization: string,
    callback: (result: string) => void
  ): void;
  deinitWidget(
    sdkAuthorization: string,
    callback: (result: string) => void
  ): void;
}

const NativeWidgetHelperModule =
  TurboModuleRegistry.get<Spec>('NativeWidgetHelperModule') ??
  NativeModules.NativeWidgetHelperModule;

export default NativeWidgetHelperModule as Spec;
