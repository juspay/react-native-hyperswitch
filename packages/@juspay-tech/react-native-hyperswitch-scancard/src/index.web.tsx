declare const window: any;

const isAvailable =
  typeof window !== 'undefined' &&
  (window.webkit?.messageHandlers?.launchScanCard ||
    window.AndroidInterface?.launchScanCard);

interface MessageEvent {
  data: any;
}

export interface ScanCardReturnType {
  status: string;
  data?: ScanCardData;
}

interface ScanCardData {
  pan: string;
  expiryMonth: string;
  expiryYear: string;
}

function launchScanCard(callback: (data: ScanCardReturnType) => void): void {
  if (isAvailable) {
    const handleMessage = (event: MessageEvent) => {
      let scanCardData = JSON.parse(event.data).scanCardData;
      if (scanCardData) {
        const status = scanCardData.status || 'Default';
        const data: ScanCardData | undefined = scanCardData.data;
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
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);
    if (window.webkit?.messageHandlers?.launchScanCard) {
      window.webkit.messageHandlers.launchScanCard.postMessage(
        'launchScanCard'
      );
    } else if (window.AndroidInterface?.launchScanCard) {
      window.AndroidInterface.launchScanCard('launchScanCard');
    }
  }
}

export { isAvailable, launchScanCard };
