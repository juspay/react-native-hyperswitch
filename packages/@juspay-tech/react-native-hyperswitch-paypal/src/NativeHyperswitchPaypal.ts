import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type PayPalNativeResult = {
  status: string;
  orderId?: string;
  payerId?: string;
  error_message?: string;
};

export interface Spec extends TurboModule {
  launchPayPal(
    requestObj: string,
    callback: (result: PayPalNativeResult) => void
  ): void;
}

export default TurboModuleRegistry.get<Spec>('HyperswitchPaypal');
