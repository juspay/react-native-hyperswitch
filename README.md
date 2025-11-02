# Hyperswitch SDK React Native Integration Guide

The `@juspay-tech/react-native-hyperswitch` provides a seamless way to integrate Hyperswitch payments into your React Native applications. This guide covers installation, configuration, and implementation.

## Installation

```bash
npm install @juspay-tech/react-native-hyperswitch
# or
yarn add @juspay-tech/react-native-hyperswitch
```

### Additional Dependencies

The SDK requires these peer dependencies:

```bash
npm install react-native-svg react-native-inappbrowser-reborn
# or
yarn add react-native-svg react-native-inappbrowser-reborn
```

### iOS Setup

For iOS, you may need to run:

```bash
cd ios && pod install
```

### React Native CodeGen

```bash
npx react-native codegen
```
This will generate all the necessary files which are required for react native new arch

## Basic Setup

### 1. Wrap Your App with HyperProvider

```tsx
import { HyperProvider } from '@juspay-tech/react-native-hyperswitch';

import {
  useHyper,
  type InitPaymentSessionParams,
  type InitPaymentSessionResult,
} from '@juspay-tech/react-native-hyperswitch';

export default function App() {
  const { initPaymentSession, presentPaymentSheet } = useHyper();

  const setup = useCallback(async (): Promise<void> => {
    try {
      // Get client secret from your backend
      const clientSecret = getCL() || "clientSecret"; 

      const params: InitPaymentSessionParams = {
        paymentIntentClientSecret: clientSecret,
      };

      const result: InitPaymentSessionResult = await initPaymentSession(params);

      if (result.error) {
        setStatus(`Initialization failed: ${result.error}`);
        console.error('Payment session initialization failed:', result.error);
      } else {
        setStatus('Ready to checkout');
      }
    } catch (error) {
      console.error('Setup failed:', error);
    }
  }, [initPaymentSession]);

  useEffect(()=>{
    setup()
  },[setup])


  return (
    <HyperProvider publishableKey="pk_snd_your_publishable_key_here">
      {/* Checkout page */}
    </HyperProvider>
  );
}
```

### 2. Present Payment Sheet

```tsx
import {
  useHyper,
  type PresentPaymentSheetParams,
  type PresentPaymentSheetResult,
} from '@juspay-tech/react-native-hyperswitch';

export default function PaymentScreen() {
  const { presentPaymentSheet } = useHyper();

  const checkout = async (): Promise<void> => {
    try {
      const options: PresentPaymentSheetParams = {
        appearance: {
          theme: 'Dark', // or 'Light'
        },
        // primaryButtonLabel: 'Complete Purchase', // Optional custom button label
      };

      const result: PresentPaymentSheetResult = await presentPaymentSheet(options);
      const { error, paymentResult } = result;

      if (error) {
        console.error('Payment failed:', JSON.stringify(error));
        // Handle payment error
      } else {
        console.log('Payment completed with status:', paymentResult?.status);
        console.log('Message:', paymentResult?.message);
        // Handle successful payment
      }
    } catch (error) {
      console.error('Checkout failed:', error);
    }
  };

  // ... rest of component
}
```

## Advanced Configuration

### Custom Appearance

```tsx
const customAppearance = {
  theme: 'Dark',
  colors: {
    background: '#452061',
    componentBackground: 'black',
    componentText: 'white',
    primary: '#77DF95',
    primaryText: 'white',
  },
  primaryButton: {
    shapes: {
      borderRadius: 36,
      shadow: {
        color: '#378C46',
        opacity: 0.5,
        blurRadius: 10,
        offset: {
          x: 0,
          y: 4,
        },
      },
    },
  },
  shapes: {
    shadow: {
      color: '#378C46',
      opacity: 1,
      blurRadius: 10,
      offset: {
        x: 0,
        y: 6,
      },
    },
  },
};

const options: PresentPaymentSheetParams = {
  appearance: customAppearance,
  primaryButtonLabel: 'Complete Purchase',
};
```

## API Reference

### Types

#### `InitPaymentSessionParams`
```tsx
interface InitPaymentSessionParams {
  paymentIntentClientSecret: string | undefined;
}
```

#### `InitPaymentSessionResult`
```tsx
interface InitPaymentSessionResult {
  error?: string;
}
```

#### `PresentPaymentSheetParams`
```tsx
interface PresentPaymentSheetParams {
  appearance?: {
    theme?: 'Light' | 'Dark';
    colors?: {
      background?: string;
      componentBackground?: string;
      componentText?: string;
      primary?: string;
      primaryText?: string;
    };
    primaryButton?: {
      shapes?: {
        borderRadius?: number;
        shadow?: ShadowConfig;
      };
    };
    shapes?: {
      shadow?: ShadowConfig;
    };
  };
  primaryButtonLabel?: string;
}
```

#### `PresentPaymentSheetResult`
```tsx
interface PresentPaymentSheetResult {
  error?: any;
  paymentResult?: {
    status?: string;
    message?: string;
  };
}
```

### Hooks

#### `useHyper()`
Returns an object with:
- `initPaymentSession(params: InitPaymentSessionParams): Promise<InitPaymentSessionResult>`
- `presentPaymentSheet(params: PresentPaymentSheetParams): Promise<PresentPaymentSheetResult>`


## Error Handling

Always implement proper error handling:

```tsx
const setup = async () => {
  try {
    const paymentIntent = await createPaymentIntent();

    if (!paymentIntent) {
      setStatus('Failed to create payment intent');
      return;
    }

    const result = await initPaymentSession({
      paymentIntentClientSecret: paymentIntent,
    });

    if (result.error) {
      setStatus(`Initialization failed: ${result.error}`);
    } else {
      setStatus('Ready to checkout');
    }
  } catch (error) {
    console.error('Setup failed:', error);
    setStatus('Setup failed');
  }
};
```

## Troubleshooting

### Common Issues

1. **Metro bundler issues with SVG**
   - Ensure `react-native-svg` is properly installed and linked

2. **Android network requests failing**
   - Use `http://10.0.2.2:PORT` instead of `localhost:PORT` for Android emulator

3. **iOS build issues**
   - Run `cd ios && pod install` after installing the SDK

4. **Payment initialization fails**
   - Verify your publishable key is correct
   - Ensure your backend returns a valid client secret
   - Check network connectivity

5. **React Native CodeGen issues**
  - Clean the android builds using gradlew clean
  - run `npx react-native codegen` to autogenerate the required files // can be skipped for old-arch

### Debug Tips

- Enable console logging to track payment flow
- Verify client secret format from your backend
- Test with different payment methods
- Check Hyperswitch dashboard for payment status

## Support

For issues and questions:
- Check the [Hyperswitch documentation](https://hyperswitch.io/docs)
- Review the SDK source code on GitHub
- Contact Hyperswitch support team