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
  HyperPaymentMethodSession,
  CardForm,
  CardNumberField,
  CardExpiryField,
  CardCVCField,
  CardholderNameField,
  type CardFormHandle,
} from "@juspay-tech/react-native-hyperswitch-payment-methods";

import { customerId, initialBaseUrl, intentData, publishableKey, sdkLogging } from "../utils";

const hyper = HyperswitchPaymentMethods.init({
  publishableKey,
  environment: "SANDBOX",
  ...sdkLogging,
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

// A saved card of the session's customer, as the server lists it
// (GET /v1/payment-method-sessions/{id}/list-payment-methods).
interface SavedCard {
  token: string;
  network?: string;
  last4: string;
  expiry: string;
  requiresCvv: boolean;
}

const toSavedCard = (method: any): SavedCard => {
  const card = method.payment_method_data?.card ?? {};
  return {
    token: method.payment_method_token,
    network: card.card_network ?? undefined,
    last4: card.last4_digits ?? "",
    expiry: `${card.expiry_month ?? ""}/${String(card.expiry_year ?? "").slice(-2)}`,
    requiresCvv: method.requires_cvv !== false,
  };
};

const fetchSavedCards = async (sessionId: string): Promise<SavedCard[]> => {
  const response = await fetch(
    `${initialBaseUrl}/payment-method-session/${encodeURIComponent(sessionId)}/saved-payment-methods`
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? `Server returned ${response.status}`);
  }
  return (data?.customer_payment_methods ?? [])
    .filter((method: any) => method.payment_method_type === "card")
    .map(toSavedCard);
};

export default function PaymentMethodFlow({ onBack }: { onBack: () => void }) {
  const vaultRef = useRef<CardFormHandle>(null);
  const [sdkAuthorization, setSdkAuthorization] = useState<string | null>(null);
  const [status, setStatus] = useState("Not started");
  const [canPay, setCanPay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  // The saved card to pay with; null pays with a new card.
  const [selectedCard, setSelectedCard] = useState<SavedCard | null>(null);

  const selectCard = (card: SavedCard | null) => {
    setCanPay(false);
    setSelectedCard(card);
  };

  const start = useCallback(async () => {
    setBusy(true);
    setStatus("Creating payment-method session...");
    try {
      const response = await fetch(
        `${initialBaseUrl}/create-payment-method-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_id: customerId }),
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
      setSelectedCard(null);
      setSdkAuthorization(authorization);
      setStatus(`Session created - vault: ${vaults.join(", ") || "none"}`);
      try {
        setSavedCards(await fetchSavedCards(data.id));
      } catch (error) {
        setSavedCards([]);
        setStatus(
          `Session created; saved cards not listed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
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
        // A payment-method session saves one card: drop it, so the next card starts a new one.
        setSdkAuthorization(null);
        setSavedCards([]);
        setSelectedCard(null);
        setCanPay(false);
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
        <HyperPaymentMethodSession
          hyper={hyper}
          options={{ sdkAuthorization, appearance }}
          onError={(error) => setStatus(error.message)}
        >
          {savedCards.length > 0 && (
            <View style={styles.savedCards}>
              <Text style={styles.sectionTitle}>Saved cards</Text>
              {savedCards.map((card) => (
                <TouchableOpacity
                  key={card.token}
                  style={[
                    styles.option,
                    selectedCard?.token === card.token && styles.optionSelected,
                  ]}
                  onPress={() => selectCard(card)}
                >
                  <Text style={styles.optionText}>
                    {card.network ?? "Card"} •••• {card.last4}
                  </Text>
                  <Text style={styles.optionHint}>{card.expiry}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.option, !selectedCard && styles.optionSelected]}
                onPress={() => selectCard(null)}
              >
                <Text style={styles.optionText}>New card</Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedCard ? (
            selectedCard.requiresCvv ? (
              // A saved card needs only its CVC: the CVC field must be the form's only field.
              <CardForm
                key={selectedCard.token}
                ref={vaultRef}
                onChange={(event) => setCanPay(event.complete && event.valid)}
                onError={(error) => setStatus(String(error))}
              >
                <CardCVCField
                  options={{
                    placeholder: "CVC",
                    savedCard: {
                      paymentMethodToken: selectedCard.token,
                      paymentMethodData: { card: { cardNetwork: selectedCard.network } },
                    },
                  }}
                />
              </CardForm>
            ) : (
              <Text style={styles.optionHint}>
                This card needs no CVC: use its token as listed.
              </Text>
            )
          ) : (
            <CardForm
              key="new"
              ref={vaultRef}
              onChange={(event) => setCanPay(event.complete && event.valid)}
              onError={(error) => setStatus(String(error))}
            >
              {/* Field options use the web SDK's nesting. */}
              <CardNumberField
                options={{
                  placeholder: "1234 5678 9012 3456",
                  cardBrandIcon: "hidden",
                }}
              />
              <View style={styles.row}>
                <View style={styles.half}>
                  <CardExpiryField options={{ placeholder: "MM / YY" }} />
                </View>
                <View style={styles.half}>
                  <CardCVCField options={{ placeholder: "CVC"}} />
                </View>
              </View>
              <CardholderNameField options={{ placeholder: "Name on card" }} />
            </CardForm>
          )}

          <TouchableOpacity
            style={[styles.button, { marginTop: 20 }]}
            onPress={pay}
            disabled={!canPay || busy}
          >
            <Text style={styles.buttonText}>Tokenize</Text>
          </TouchableOpacity>
        </HyperPaymentMethodSession>
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
  savedCards: { marginBottom: 16, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#111827" },
  option: {
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionSelected: { borderColor: "#111827", backgroundColor: "#f3f4f6" },
  optionText: { fontSize: 14, color: "#111827" },
  optionHint: { fontSize: 12, color: "#6b7280" },
});
