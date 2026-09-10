import { useEffect, useState } from "react";

import type { ReactNode } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";

import type {
  CustomerLastUsedPaymentMethod,
  CustomerSavedPaymentMethodsSession,
  Elements,
} from "@juspay-tech/react-native-hyperswitch";

export const AMOUNTS = [5, 10, 25, 50];

export type FormLayoutProps = {
  isAmountScreen: boolean;

  setIsAmountScreen: (value: boolean) => void;

  amount: number;

  setAmount: (value: number) => void;

  onClose: () => void;

  cvcSlot: ReactNode;

  paymentSlot: ReactNode;

  buttonSlot: ReactNode;

  lastUsed: CustomerLastUsedPaymentMethod | null | undefined;

  methodsSession: CustomerSavedPaymentMethodsSession | null;

  loadingSaved: boolean;

  canSubmit: boolean;

  updateAmount: (() => Promise<void>) | null;

  widgets: Elements | null;

  loading: boolean;

  message: string;

  setMessage: (message: string) => void;

  paymentElementReady: boolean;

  walletReady: boolean;

  cvcReady: boolean;

  requiresCvc: boolean;
};

function formatCardLabel(method: CustomerLastUsedPaymentMethod | null): string {
  if (!method) {
    return "Add payment method";
  }

  const card = method.card;

  if (card) {
    const brand = card.scheme ?? card.card_network ?? "Card";

    const last4 = card.last4_digits ?? "••••";

    return `${brand} •••• ${last4}`;
  }

  return method.payment_method_type ?? method.payment_method ?? "Saved method";
}

export function FormLayout({
  isAmountScreen,
  setIsAmountScreen,
  amount,
  setAmount,
  onClose,
  cvcSlot,
  buttonSlot,
  paymentSlot,
  lastUsed,
  methodsSession,
  loadingSaved,
  canSubmit,
  updateAmount,
  widgets,
  loading,
  message,
  setMessage,
  paymentElementReady,
  walletReady,
  requiresCvc,
}: FormLayoutProps) {
  const [amountVal, setAmountVal] = useState(amount);
  const [isLoading, setIsLoading] = useState(false);
  const handleDeposit = async () => {
    if (!canSubmit || isLoading) {
      return;
    }

    setMessage("");
    setIsLoading(true);

    try {
      if (isAmountScreen && !lastUsed) {
        setIsAmountScreen(false);

        return;
      }
      if (isAmountScreen) {
        if (!methodsSession) {
          return;
        }

        const {
          type,
          message: resultMessage,
          status,
        } = await methodsSession.confirmWithCustomerLastUsedPaymentMethod({
          id: "card-cvc-element",
        });

        console.log("[Example] Saved payment method result:", {
          type,
          message: resultMessage,
          status,
        });
        if (type === "validation_error") {
          setMessage("CVC is invalid or missing. Please fill the form");
          return;
        }
        onClose();
        switch (status) {
          case "completed":
            setTimeout(() => {
              Alert.alert("Payment completed successfully!");
            }, 0);
            return;
          case "canceled":
            setTimeout(() => {
              Alert.alert("Payment canceled");
            }, 0);
            return;
          default:
            setTimeout(() => {
              Alert.alert(
                "Payment failed",
                `Type: ${type}\nMessage: ${resultMessage ?? ""}`,
              );
            }, 0);
            return;
        }
      }

      if (!widgets) {
        return;
      }

      const {
        type,
        message: resultMessage,
        status,
      } = await widgets.confirmPayment("payment-element-id");

      console.log(
        "[Example] Payment result:",
        JSON.stringify({
          type,
          message: resultMessage,
          status,
        }),
      );
      if (type === "form_validation_error") {
        setMessage("Please fill the form");
        return;
      }
      onClose();
      switch (status) {
        case "completed":
          setTimeout(() => {
            Alert.alert("Payment completed successfully!");
          }, 0);
          return;
        case "canceled":
          setTimeout(() => {
            Alert.alert("Payment canceled");
          }, 0);
          return;
        default:
          setTimeout(() => {
            Alert.alert(
              "Payment failed",
              `Type: ${type}\nMessage: ${resultMessage ?? ""}`,
            );
          }, 0);
          return;
      }
    } catch (error: unknown) {
      console.error("[Example] Payment confirmation failed:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Payment failed";

      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (amountVal !== amount) {
      setAmountVal(amount);
    }
  }, [amount, amountVal]);

  const handleAmountBlur = () => {
    if (amountVal !== amount) {
      setAmount(amountVal);
    }
  };

  const buttonDisabled = !canSubmit || isLoading || loading;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {!isAmountScreen && (
          <TouchableOpacity
            onPress={() => setIsAmountScreen(true)}
            style={styles.backButton}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.title}>
          {isAmountScreen ? "Deposit Amount" : ""}
        </Text>

        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {isAmountScreen && (
          <Text style={styles.balance}>
            Balance: <Text style={styles.balanceBold}>$65.15</Text>
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />

          <Text style={styles.loadingText}>Updating amount...</Text>
        </View>
      ) : (
        <>
          {isAmountScreen && (
            <View style={styles.savedSection}>
              {buttonSlot ? (
                <View style={styles.walletContainer}>
                  <View
                    style={[
                      styles.walletNativeView,
                      !walletReady && styles.hiddenSdkView,
                    ]}
                  >
                    {buttonSlot}
                  </View>

                  {!walletReady && (
                    <View pointerEvents="none" style={styles.walletSkeleton} />
                  )}
                </View>
              ) : null}

              {loadingSaved ? (
                <View style={styles.savedRow}>
                  <View style={[styles.skeleton, styles.savedMethodSkeleton]} />

                  <View style={[styles.skeleton, styles.cvcSkeleton]} />
                </View>
              ) : lastUsed ? (
                <View style={styles.savedRow}>
                  <TouchableOpacity
                    onPress={() => setIsAmountScreen(false)}
                    style={styles.savedMethod}
                  >
                    <Text style={styles.savedMethodText}>
                      {formatCardLabel(lastUsed)}
                    </Text>

                    <Text style={styles.chevron}>⌄</Text>
                  </TouchableOpacity>

                  {requiresCvc ? (
                    <View style={styles.cvcContainer}>
                      <View style={[styles.cvcBox]}>{cvcSlot}</View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}

          {!isAmountScreen && (
            <View style={styles.paymentSection}>
              {paymentSlot}
              {!paymentElementReady && (
                <View pointerEvents="none" style={styles.paymentLoadingBadge}>
                  <ActivityIndicator size="small" color="#059669" />

                  <Text style={styles.paymentLoadingText}>
                    Loading payment methods...
                  </Text>
                </View>
              )}
            </View>
          )}

          {isAmountScreen && (
            <>
              <View style={styles.amountSection}>
                <View style={styles.amountRow}>
                  <Text style={styles.currency}>CA$</Text>

                  <TextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={String(amountVal)}
                    onChangeText={(text) => {
                      const value = parseInt(text, 10);

                      setAmountVal(Number.isNaN(value) ? 0 : value);
                    }}
                    onBlur={handleAmountBlur}
                  />
                </View>

                <Text style={styles.hint}>Minimum deposit is CA$1</Text>
              </View>

              <View style={styles.chipRow}>
                {AMOUNTS.map((value) => {
                  const selected = value === amount;

                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setAmount(value)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text
                        style={[
                          styles.chipText,

                          selected && styles.chipTextSelected,
                        ]}
                      >
                        CA${value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      <View style={styles.footer}>
        {message ? <Text style={styles.error}>{message}</Text> : null}

        <TouchableOpacity
          disabled={buttonDisabled}
          onPress={handleDeposit}
          style={[
            styles.depositButton,

            buttonDisabled && styles.depositButtonDisabled,
          ]}
        >
          <Text style={styles.depositButtonText}>
            {isLoading
              ? "Processing…"
              : !canSubmit && !isAmountScreen
              ? "Loading payment…"
              : `Deposit $${amount}`}
          </Text>
        </TouchableOpacity>

        {isAmountScreen ? (
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.secure}>
            🔒 Your payment is secure & encrypted
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
    maxHeight: 600,
    minHeight: 400,
  },

  header: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: "center",
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },

  backButton: {
    position: "absolute",
    left: 16,
    top: 24,
    padding: 8,
  },

  backText: {
    fontSize: 22,
    color: "#6b7280",
  },

  closeButton: {
    position: "absolute",
    right: 16,
    top: 24,
    padding: 8,
  },

  closeText: {
    fontSize: 20,
    color: "#6b7280",
  },

  balance: {
    marginTop: 4,
    fontSize: 14,
    color: "#4b5563",
  },

  balanceBold: {
    fontWeight: "700",
    color: "#111827",
  },

  savedSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  skeleton: {
    backgroundColor: "#e5e7eb",

    borderRadius: 12,
  },
  walletContainer: {
    height: 58,
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
  },
  walletNativeView: {
    width: "100%",
    height: "100%",
  },
  walletSkeleton: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
  },
  hiddenSdkView: {
    opacity: 0,
  },

  savedRow: {
    flexDirection: "row",
    gap: 12,
    minHeight: 54,
  },

  savedMethodSkeleton: {
    flex: 1,
    height: 54,
  },

  savedMethod: {
    flex: 1,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    backgroundColor: "#fff",

    borderRadius: 12,

    paddingHorizontal: 16,

    paddingVertical: 14,

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 1,
    },

    shadowOpacity: 0.05,

    shadowRadius: 2,

    elevation: 1,
  },

  savedMethodText: {
    fontSize: 14,

    fontWeight: "500",

    color: "#111827",
  },

  chevron: {
    fontSize: 20,
    color: "#6b7280",
  },

  cvcContainer: {
    width: 96,

    minHeight: 54,

    position: "relative",

    borderRadius: 12,

    overflow: "hidden",
  },

  cvcBox: {
    width: 96,

    minHeight: 54,

    borderRadius: 12,

    backgroundColor: "#fff",

    overflow: "hidden",

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 1,
    },

    shadowOpacity: 0.05,

    shadowRadius: 2,

    elevation: 1,
  },

  cvcSkeleton: {
    width: 96,
    height: 54,
  },

  cvcSkeletonOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  paymentSection: {
    minHeight: 400,

    position: "relative",
  },

  paymentLoadingBadge: {
    position: "absolute",

    top: 12,

    left: 20,

    right: 20,

    minHeight: 44,

    borderRadius: 12,

    backgroundColor: "#f3f4f6",

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    gap: 8,
  },

  paymentLoadingText: {
    fontSize: 13,
    color: "#6b7280",
  },

  amountSection: {
    alignItems: "center",

    paddingTop: 24,

    paddingHorizontal: 20,
  },

  amountRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 8,
  },

  currency: {
    fontSize: 24,

    fontWeight: "600",

    color: "#111827",
  },

  amountInput: {
    minWidth: 120,

    fontSize: 56,

    fontWeight: "600",

    color: "#111827",

    textAlign: "center",

    backgroundColor: "#fff",

    borderRadius: 8,

    paddingHorizontal: 12,
  },

  hint: {
    marginTop: 12,

    fontSize: 14,

    color: "#6b7280",
  },

  chipRow: {
    flexDirection: "row",

    gap: 12,

    paddingHorizontal: 20,

    paddingTop: 16,

    paddingBottom: 20,
  },

  chip: {
    flex: 1,

    paddingVertical: 14,

    borderRadius: 12,

    backgroundColor: "#fff",

    alignItems: "center",

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 1,
    },

    shadowOpacity: 0.05,

    shadowRadius: 2,

    elevation: 1,
  },

  chipSelected: {
    backgroundColor: "#059669",
  },

  chipText: {
    fontSize: 14,

    fontWeight: "600",

    color: "#111827",
  },

  chipTextSelected: {
    color: "#fff",
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  error: {
    marginBottom: 12,

    textAlign: "center",

    color: "#dc2626",

    fontSize: 14,
  },

  depositButton: {
    height: 56,

    borderRadius: 999,

    backgroundColor: "#059669",

    alignItems: "center",

    justifyContent: "center",

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.15,

    shadowRadius: 8,

    elevation: 3,
  },

  depositButtonDisabled: {
    opacity: 0.6,
  },

  depositButtonText: {
    color: "#fff",

    fontSize: 16,

    fontWeight: "700",
  },

  cancel: {
    marginTop: 12,

    textAlign: "center",

    color: "#6b7280",

    fontSize: 14,
  },

  secure: {
    marginTop: 12,

    textAlign: "center",

    color: "#6b7280",

    fontSize: 12,
  },

  loadingContainer: {
    flex: 1,

    minHeight: 350,

    alignItems: "center",

    justifyContent: "center",

    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
});
