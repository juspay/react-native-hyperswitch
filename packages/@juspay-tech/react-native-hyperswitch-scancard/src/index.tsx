import { NativeModules } from 'react-native';

const HyperswitchScancard = NativeModules.HyperswitchScancard || null;

const isAvailable = HyperswitchScancard && HyperswitchScancard.launchScanCard;

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
  if (isAvailable) {
    return HyperswitchScancard.launchScanCard(
      '',
      (response: Record<string, any>) => {
        const status = response.status || 'Default';
        const data: ScanCardData | undefined = response.data;
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
      }
    );
  }
}

export { isAvailable, launchScanCard };
