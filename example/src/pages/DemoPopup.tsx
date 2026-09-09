import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import {
  HyperElements,
  type HyperswitchSession,
} from "@juspay-tech/react-native-hyperswitch";
import { FormLayout } from "./FormLayout";
import { HyperContent, type SharedProps } from "./HyperContent";

type DemoPopupProps = {
  hyperPromise: Promise<HyperswitchSession>;
  sdkAuthorization: string | null;
  setSdkAuthorization: (v: string | null) => void;
  paymentId: string | null;
  setPaymentId: (v: string | null) => void;
  loadError: string | null;
  setLoadError: (v: string | null) => void;
  onClose: () => void;
};

export default function DemoPopup({
  hyperPromise,
  sdkAuthorization,
  setSdkAuthorization,
  paymentId,
  loadError,
  onClose,
}: DemoPopupProps) {
  const [isAmountScreen, setIsAmountScreen] = useState(true);
  const [amount, setAmount] = useState(5);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    setIsTransitioning(true);
    const id = setTimeout(() => setIsTransitioning(false), 300);
    return () => clearTimeout(id);
  }, [isAmountScreen]);

  const sharedProps: SharedProps = {
    isAmountScreen,
    setIsAmountScreen,
    amount,
    setAmount,
    onClose,
    paymentId,
    sdkAuthorization,
    setSdkAuthorization,
    loading: isTransitioning,
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        {isTransitioning && (
          <View style={styles.spinnerOverlay}>
            <ActivityIndicator size="large" color="#059669" />
          </View>
        )}

        {loadError && <Text style={styles.errorText}>{loadError}</Text>}

        {!sdkAuthorization ? (
          <FormLayout
            {...sharedProps}
            message={""}
            setMessage={() => {}}
            loading={false}
            loadingSaved={true}
            requiresCvc={false}
            cvcSlot={
              <View style={styles.cvcPlaceholder}>
                <Text style={styles.placeholderText}>CVC</Text>
              </View>
            }
            paymentSlot={
              <View style={styles.paymentPlaceholder}>
                <Text style={styles.placeholderText}>
                  Loading payment methods…
                </Text>
              </View>
            }
            buttonSlot={
              <View style={styles.paymentPlaceholder}>
                <Text style={styles.placeholderText}>Loading button…</Text>
              </View>
            }
            lastUsed={null}
            methodsSession={null}
            canSubmit={false}
            amount={amount}
            updateAmount={null}
            widgets={null}
            paymentElementReady={false}
            cvcReady={false}
            walletReady={false}
            walletsCheckLoading={true}
          />
        ) : (
          <HyperElements hyper={hyperPromise} options={{ sdkAuthorization }}>
            <HyperContent {...sharedProps} />
          </HyperElements>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 50,
  },
  sheet: {
    width: "100%",
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  spinnerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  errorText: {
    color: "#dc2626",
    textAlign: "center",
    padding: 16,
  },
  cvcPlaceholder: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 8,
  },
  paymentPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#9ca3af",
    fontSize: 14,
  },
});
