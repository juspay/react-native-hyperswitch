import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type ScanCardResponse = {
  status?: string;
  data?: {
    pan?: string;
    expiryMonth?: string;
    expiryYear?: string;
  };
};

export interface Spec extends TurboModule {
  launchScanCard(
    scanCardRequest: string,
    callback: (response: ScanCardResponse) => void
  ): void;
}

export default TurboModuleRegistry.get<Spec>('HyperswitchScancard');
