import { Platform } from 'react-native';
import { type PresentPaymentSheetParams } from '@juspay-tech/react-native-hyperswitch';

export const initialBaseUrl =
  Platform.OS === 'android' ? 'http://10.0.2.2:5252' : 'http://localhost:5252';

export const getCustomisationOptions = () => {
  const options: PresentPaymentSheetParams = {
    appearance: {
      theme: 'Light',
      layout: 'tabs',
      colors: {
        dark: {
          background: '#F9FAFB',
          componentBackground: '#00000030',
          componentText: 'white',
          primary: '#2563EB',
          primaryText: 'white',
        },
      },
      primaryButton: {
        primaryButtonColor: {
          dark: {
            background: '#1D4ED8',
          },
        },
        shapes: {
          borderRadius: 36,
        },
      },
      shapes: {
        shadow: {
          color: '#1D4ED8',
          opacity: 1,
          blurRadius: 10,
          offset: {
            x: 0,
            y: 6,
          },
        },
      },
    },
    primaryButtonLabel: 'Complete Purchase',
  };

  return options;
};

export const getStatus = (paymentStatus: any) => {
  let status = paymentStatus ?? 'Unknown';
  return status.length > 1
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : status;
};

export const getErrorMessage = (error: any) => {
  if (typeof error === 'string') {
    return error;
  } else if (error instanceof Error) {
    return error.message;
  } else {
    return JSON.stringify(error);
  }
};
