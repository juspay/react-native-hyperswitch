import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import {
  useHyper,
  type InitPaymentSessionParams,
  type InitPaymentSessionResult,
  type PresentPaymentSheetResult,
} from '@juspay-tech/react-native-hyperswitch';
import {
  initialBaseUrl,
  getCustomisationOptions,
  getStatus,
  getErrorMessage,
} from './utils';
import { styles } from './styles';

export default function PaymentScreen() {
  const { initPaymentSession, presentPaymentSheet } = useHyper();
  const [status, setStatus] = useState<string | null | undefined>(null);
  const [message, setMessage] = useState<string | null | undefined>(null);
  const [baseURL, setBaseURL] = useState<string>(initialBaseUrl);

  const createPaymentIntent = useCallback(async (): Promise<string> => {
    const response = await fetch(`${baseURL}/create-payment-intent`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create payment intent');
    }
    return data.clientSecret;
  }, [baseURL]);

  const setup = useCallback(async (): Promise<void> => {
    const paymentIntent = await createPaymentIntent();

    if (paymentIntent !== undefined) {
      const params: InitPaymentSessionParams = {
        paymentIntentClientSecret: paymentIntent,
      };
      const result: InitPaymentSessionResult = await initPaymentSession(params);
      if (result.error) {
        throw new Error(result.error);
      } else {
        setStatus('Ready to checkout');
        setMessage(null);
      }
    }
  }, [initPaymentSession, createPaymentIntent]);

  const checkout = async (): Promise<void> => {
    try {
      const { error, paymentResult }: PresentPaymentSheetResult =
        await presentPaymentSheet(getCustomisationOptions());
      if (error) {
        console.error('Payment failed:', JSON.stringify(error, null, 2));
        setStatus(`Payment failed: ${error.code}`);
        setMessage(error.message);
      } else {
        console.log(
          'Payment completed with status:',
          JSON.stringify(paymentResult, null, 2)
        );
        setStatus(getStatus(paymentResult?.status));
        setMessage(paymentResult?.message);
      }
    } catch (error: any) {
      console.error('Checkout failed:', error);
      setStatus(`Checkout failed`);
      setMessage(error.message);
    }
  };

  useEffect(() => {
    try {
      setup();
    } catch (error) {
      console.error('Setup failed:', error);
      setStatus('Setup Error:');
      setMessage(getErrorMessage(error));
    }
  }, [setup]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.textInput}
        placeholder="Enter base URL"
        value={baseURL}
        onChangeText={(text) => setBaseURL(text)}
      />
      <TouchableOpacity style={styles.button} onPress={setup}>
        <Text style={styles.buttonText}>Reload client Secret</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={checkout}>
        <Text style={styles.buttonText}>Checkout</Text>
      </TouchableOpacity>
      <View style={styles.status}>
        <Text style={styles.statusText}>{status}</Text>
        {message && <Text style={styles.messageText}>{message}</Text>}
      </View>
    </View>
  );
}
