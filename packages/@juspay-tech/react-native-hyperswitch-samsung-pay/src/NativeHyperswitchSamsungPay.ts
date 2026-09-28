import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type SamsungPayStatus = {
  status: string;
  message: string;
};

export interface Spec extends TurboModule {
  checkSamsungPayValidity(
    requestObj: string,
    callback: (status: SamsungPayStatus) => void
  ): void;
  activateSamsungPay(callback: (status: SamsungPayStatus) => void): void;
  // Native invokes the callback with (status) or, when Samsung Pay returns
  // billing/shipping details, with (status, details).
  presentSamsungPayPaymentSheet(
    callback: (status: SamsungPayStatus, details?: Object) => void
  ): void;
}

export default TurboModuleRegistry.get<Spec>('HyperswitchSamsungPay');
