import NativeHyperswitchScancard from './NativeHyperswitchScancard';
import type {ScanCardResponse} from './NativeHyperswitchScancard';

// TurboModuleRegistry.get returns null when the native module is not linked
// into the host app, which lets consumers treat this package as optional.
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
