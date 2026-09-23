import NativeHyperswitchScancard from './NativeHyperswitchScancard';
import type {ScanCardResponse} from './NativeHyperswitchScancard';

// TurboModuleRegistry.get resolves the TurboModule on the new architecture
// and falls back to the legacy NativeModules entry on the old architecture,
// so this single code path supports both.
const isAvailable = NativeHyperswitchScancard != null;

export interface ScanCardReturnType {
  status: string;
  data?: ScanCardData;
}

interface ScanCardData {
  pan: string;
  expiryMonth: string;
  expiryYear: string;
}

function launchScanCard(callback: (s: ScanCardReturnType) => void): void {
  if (NativeHyperswitchScancard) {
    NativeHyperswitchScancard.launchScanCard('', (response: ScanCardResponse) => {
      const status = response.status || 'Default';
      const data = response.data;
      const scanData: ScanCardReturnType = {
        status,
        data: data
          ? {
              pan: data.pan || '',
              expiryMonth: data.expiryMonth || '',
              expiryYear: data.expiryYear || '',
            }
          : undefined,
      };
      callback(scanData);
    });
  }
}

export {isAvailable, launchScanCard};
