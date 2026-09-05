import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Hyperswitch as HyperswitchPaymentMethods,
  HyperPaymentMethodsSession,
  CardForm,
  CardNumberField,
  CardExpiryField,
  CardCVCField,
  CardholderNameField,
  type CardFormHandle,
} from "@juspay-tech/react-native-hyperswitch-payment-methods";

import { initialBaseUrl, intentData, publishableKey } from "../utils";

const hyper = HyperswitchPaymentMethods.init({
  publishableKey,
  environment: "SANDBOX",
});

const appearance = {
  container: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 12,
    marginTop: 12,
    justifyContent: "center" as const,
  },
  input: { color: "#111827", fontSize: 16 },
};

export default function PaymentMethodFlow({ onBack }: { onBack: () => void }) {
  const vaultRef = useRef<CardFormHandle>(null);
  const [sdkAuthorization, setSdkAuthorization] = useState<string | null>(null);
  const [status, setStatus] = useState("Not started");
  const [canPay, setCanPay] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    setBusy(true);
    setStatus("Creating payment-method session...");
    try {
      const response = await fetch(
        `${initialBaseUrl}/create-payment-method-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_id: '12345_cus_019d109101b07911be86fc8bab029d45' }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `Server returned ${response.status}`);
      }
      const authorization = data.sdk_authorization ?? data.sdkAuthorization;
      if (!authorization) {
        throw new Error("Server returned no sdk_authorization");
      }
      const vaults = Object.keys(data.external_vault_details ?? {});
      setSdkAuthorization(authorization);
      setStatus(`Session created - vault: ${vaults.join(", ") || "none"}`);
    } catch (error) {
      console.log(error)
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, []);

  const pay = useCallback(async () => {
    setBusy(true);
    try {
      const result = await vaultRef.current?.tokenize();
      if (result?.status === "success") {
        setStatus(`Tokenized: ${JSON.stringify(result.data?.tokens)}`);
      } else if (result?.error) {
        setStatus(`${result.error.code}: ${result.error.message}`);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {sdkAuthorization ? (
        <HyperPaymentMethodsSession
          hyper={hyper}
          options={{ sdkAuthorization, appearance }}
          onError={(error) => setStatus(error.message)}
        >
          <CardForm
            ref={vaultRef}
            onChange={(event) => setCanPay(event.complete && event.valid)}
            onError={(error) => setStatus(String(error))}
          >
            <CardNumberField placeholder="1234 5678 9012 3456" />
            <View style={styles.row}>
              <View style={styles.half}>
                <CardExpiryField placeholder="MM / YY" />
              </View>
              <View style={styles.half}>
                <CardCVCField placeholder="CVC" />
              </View>
            </View>
            <CardholderNameField placeholder="Name on card" />
          </CardForm>

          <TouchableOpacity
            style={[styles.button, { marginTop: 20 }]}
            onPress={pay}
            disabled={!canPay || busy}
          >
            <Text style={styles.buttonText}>Tokenize</Text>
          </TouchableOpacity>
        </HyperPaymentMethodsSession>
      ) : (
        <TouchableOpacity style={styles.button} onPress={start} disabled={busy}>
          <Text style={styles.buttonText}>Start payment method session</Text>
        </TouchableOpacity>
      )}

      {busy && <ActivityIndicator style={{ marginTop: 16 }} />}

      <TouchableOpacity
        style={[styles.button, styles.secondary, { marginTop: 16 }]}
        onPress={onBack}
      >
        <Text style={[styles.buttonText, { color: "#111827" }]}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 16 },
  statusBar: {
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
  },
  statusText: { fontSize: 13, color: "#111827" },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  button: {
    height: 48,
    borderRadius: 999,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: "#e5e7eb" },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "500" },
});
