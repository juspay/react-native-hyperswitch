import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import {
  ApplePayButton,
  CardCVCElement,
  GooglePayButton,
  PaymentElement,
  SubscriptionEvent,
  isPlatformPaySupported,
  usePaymentSession,
  useWidgets,
  type CustomerLastUsedPaymentMethod,
  type CustomerSavedPaymentMethodsSession,
  type PaymentElementHandle,
  type PaymentEventResult,
  type PaymentResult,
} from "@juspay-tech/react-native-hyperswitch";

import { FormLayout } from "./FormLayout";
import { initialBaseUrl } from "../utils";

export type {
  CustomerLastUsedPaymentMethod,
  CustomerSavedPaymentMethodsSession,
};

export type SharedProps = {
  isAmountScreen: boolean;
  setIsAmountScreen: (value: boolean) => void;
  amount: number;
  setAmount: (value: number) => void;
  onClose: () => void;
  paymentId: string | null;
  sdkAuthorization: string | null;
  setSdkAuthorization: (value: string | null) => void;
  loading: boolean;
};

const HIDDEN_PAYMENT_METHODS = ["paypal", "google_pay", "apple_pay"] as const;

const CVC_APPEARANCE = {
  theme: "Light" as const,

  shapes: {
    borderRadius: 0,
    borderWidth: 0,

    shadow: {
      blurRadius: 0,
      intensity: 0,
    },
  },
};

const PAYMENT_ELEMENT_OPTIONS = {
  merchantDisplayName: "Hyperswitch Example",

  displayDefaultSavedPaymentIcon: false,

  paymentMethodLayout: {
    type: "tabs" as const,

    radios: false,

    maxAccordionItems: 2,

    defaultCollapsed: true,

    spacedAccordionItems: true,

    cvcIcon: "hidden" as const,

    cardBrandIcon: "hideGeneric" as const,

    showCheckedIconForSelection: true,

    savedMethodCustomization: {
      cvcIcon: "hidden" as const,

      hideCardExpiry: true,

      defaultCollapsed: false,

      groupingBehavior: {
        displayInSeparateScreen: false,
      },

      hiddenPaymentMethods: [...HIDDEN_PAYMENT_METHODS],
    },
  },

  appearance: {
    theme: "Light" as const,

    shapes: {
      borderRadius: 16,

      borderWidth: 1,

      inputHeight: 56,

      gap: 24,

      shadow: {
        color: "#000000",

        opacity: 0,

        blurRadius: 0,

        intensity: 0,

        offset: {
          x: 0,
          y: 0,
        },
      },
    },

    primaryButton: {
      height: 56,
    },

    logo: {
      borderRadius: 50,

      colors: {
        light: {
          backgroundColor: "black",
          unselected: "white",
        },

        dark: {
          backgroundColor: "white",
          unselected: "black",
        },
      },
    },
  },

  splitCardFields: true,

  subscribedEvents: [
    "PAYMENT_METHOD_STATUS",
    "PAYMENT_METHOD_INFO_BILLING_ADDRESS",
    "PAYMENT_METHOD_INFO_CARD",
    'FORM_STATUS',
  ] as SubscriptionEvent[],
};

export function HyperContent(props: SharedProps) {
  const { amount, paymentId, onClose, setSdkAuthorization, isAmountScreen } =
    props;

  const paymentSession = usePaymentSession();

  const [walletEligible, setWalletEligible] = useState<boolean | null>(null);

  const [deviceSupportsWallet, setDeviceSupportsWallet] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    const probeDeviceSupport = async () => {
      const supported = await isPlatformPaySupported();
      if (!cancelled) {
        setDeviceSupportsWallet(supported);
      }
    };

    probeDeviceSupport();

    return () => {
      cancelled = true;
    };
  }, []);
  const widgets = useWidgets();

  const paymentRef = useRef<PaymentElementHandle>(null);

  const [message, setMessage] = useState("");

  const [overlayLoading, setOverlayLoading] = useState(false);

  const [loadingSaved, setLoadingSaved] = useState(false);

  /**
   * Readiness states.
   *
   * These are deliberately separate because each SDK
   * widget becomes ready independently.
   */
  const [paymentElementReady, setPaymentElementReady] = useState(false);


  const [cvcReady, setCvcReady] = useState(false);

  const [lastUsed, setLastUsed] = useState<
    CustomerLastUsedPaymentMethod | null | undefined
  >(null);

  const [methodsSession, setMethodsSession] =
    useState<CustomerSavedPaymentMethodsSession | null>(null);

  const handlePaymentResult = useCallback(
    (data: PaymentResult) => {
      console.log("[Example] Payment result:", data);

      onClose();

      setTimeout(() => {
        switch (data.status) {
          case "completed":
            Alert.alert("Payment completed successfully");
            break;

          case "canceled":
            Alert.alert("Payment cancelled");
            break;

          default:
            Alert.alert(`Type: ${data?.type}`, `Message: ${data?.message}`);
        }
      }, 0);
    },
    [onClose],
  );

  useEffect(() => {
    setPaymentElementReady(false);
    setCvcReady(false);
  }, [paymentSession]);

  useEffect(() => {
    if (!paymentSession) {
      setLoadingSaved(false);
      setMethodsSession(null);
      setLastUsed(null);

      return;
    }

    let cancelled = false;

    const loadSavedPaymentMethods = async () => {
      setLoadingSaved(true);

      try {
        const session = await paymentSession.getCustomerSavedPaymentMethods({
          hiddenPaymentMethods: [...HIDDEN_PAYMENT_METHODS],
        });

        if (cancelled) {
          return;
        }

        setMethodsSession(session);

        const data = await session.getCustomerLastUsedPaymentMethodData();

        if (cancelled) {
          return;
        }

        console.log("[Example] Last used payment method data:", data);

        setLastUsed(data?.status === "failed" ? null : data);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("[Example] Failed to load saved payment methods:", error);

        setLastUsed(undefined);
        setMethodsSession(null);
      } finally {
        if (!cancelled) {
          setLoadingSaved(false);
        }
      }
    };

    // TEMP: disabled while the wallet flow and the saved-methods flow contend
    // for the shared headless surface on iOS. Uncomment to restore last-used.
    // void loadSavedPaymentMethods();

    return () => {
      cancelled = true;
    };
  }, [paymentSession]);

  useEffect(() => {
    setCvcReady(false);
  }, [lastUsed]);

  const handlePaymentElementChange = useCallback(
    (event: PaymentEventResult) => {
      console.log("[Example] PaymentElement onChange:", JSON.stringify(event));

      if (event.eventName !== "PAYMENT_METHOD_STATUS") {
        return;
      }

      console.log(
        "[Example] PaymentElement ready from PAYMENT_METHOD_STATUS",
        JSON.stringify(event.payload),
      );

      setPaymentElementReady(true);
    },
    [],
  );

  const walletSupported = deviceSupportsWallet === true;

  const walletResolving = walletSupported && walletEligible === null;

  const walletReady = walletSupported && walletEligible === true;


  const handleCvcReady = useCallback(() => {
    console.log("[Example] CvcWidget ready");

    setCvcReady(true);
  }, []);

  const updateAmount = useCallback(async () => {
    if (!paymentSession || !paymentId) {
      console.log(
        "[Example] Cannot update amount: paymentSession or paymentId is null",
      );

      return;
    }

    setOverlayLoading(true);
    setMessage("");
    setWalletEligible(null);

    try {
      await paymentSession.updateIntent(async () => {
        const controller = new AbortController();

        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
          const response = await fetch(`${initialBaseUrl}/update-payment`, {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              payment_id: paymentId,

              amount: amount * 100,
            }),

            signal: controller.signal,
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data?.error ?? "Update failed");
          }

          setSdkAuthorization(data.sdkAuthorization);

          return {
            sdkAuthorization: data.sdkAuthorization,
          };
        } finally {
          clearTimeout(timeoutId);
        }
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessage("Request timed out. Please try again.");
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        setMessage(`Failed to update amount: ${errorMessage}`);
      }

      throw error;
    } finally {
      setOverlayLoading(false);
    }
  }, [paymentSession, paymentId, amount, setSdkAuthorization]);

  const lastSyncedAmount = useRef(amount);

  useEffect(() => {
    if (lastSyncedAmount.current === amount) {
      return;
    }
    lastSyncedAmount.current = amount;

    const syncIntent = async () => {
      try {
        await updateAmount();
      } catch {
        console.log("[Example] updateIntent failed for amount", amount);
      }
    };

    syncIntent();
  }, [amount, updateAmount]);

  const walletButton = !walletSupported ? null : (
    <View style={styles.walletWrapper}>
      {Platform.OS === "ios" ? (
        <ApplePayButton
          options={{
            appearance: { shapes: { borderRadius: 8 } },
            walletButtonsConfiguration: {
              applePay: {
                visibility: "shown",
                buttonType: "buy",
                buttonStyle: { light: "black", dark: "white" },
              },
            },
          }}
          style={{ width: "100%", height: 48 }}
          onReady={() => setWalletEligible(true)}
          onLoadError={(error) => {
            console.log("[Example] Apple Pay unavailable", error.type);
            setWalletEligible(false);
          }}
          onPaymentResult={handlePaymentResult}
        />
      ) : (
        <GooglePayButton
          options={{
            appearance: { shapes: { borderRadius: 8 } },
            walletButtonsConfiguration: {
              googlePay: {
                visibility: "shown",
                buttonType: "BUY",
                buttonStyle: { light: "light", dark: "dark" },
              },
            },
          }}
          style={{ width: "100%", height: 48 }}
          onReady={() => setWalletEligible(true)}
          onLoadError={(error) => {
            console.log("[Example] Google Pay unavailable", error.type);
            setWalletEligible(false);
          }}
          onPaymentResult={handlePaymentResult}
        />
      )}

      {!walletReady ? (
        <View style={styles.walletOverlay}>
          {walletResolving ? <ActivityIndicator /> : null}
        </View>
      ) : null}
    </View>
  );

  const requiresCvc = lastUsed?.payment_method === "card";

  const cvcElement = requiresCvc ? (
    <CardCVCElement
      id="card-cvc-element"
      options={{
        placeholder: "123",
        appearance: CVC_APPEARANCE,
        cvcIcon: "hidden",
        subscribedEvents: ["CVC_STATUS"],
      }}
      onReady={handleCvcReady}
      onFocus={() => console.log("[Example] CvcWidget focused")}
      onBlur={() => console.log("[Example] CvcWidget blurred")}
      style={{
        minHeight: 50,
      }}
    />
  ) : null;

  /**
   * Main footer button readiness.
   *
   * PAYMENT SCREEN
   * ----------------
   * User cannot confirm until PaymentElement emits
   * PAYMENT_METHOD_STATUS.
   *
   * AMOUNT / SAVED METHOD SCREEN
   * ----------------------------
   *
   * No saved method:
   * Deposit is enabled so that pressing it can move
   * the user to the PaymentElement screen.
   *
   * Saved card:
   * Deposit stays disabled until:
   * - saved methods are loaded
   * - methodsSession exists
   * - CVC widget has fired onReady
   *
   * Saved non-card method:
   * CVC isn't required.
   */
  const canSubmit = (() => {
    if (!paymentSession || overlayLoading) {
      return false;
    }
    if (!isAmountScreen) {
      return Boolean(widgets && paymentElementReady);
    }

    if (loadingSaved) {
      return false;
    }

    /**
     * No saved payment method.
     *
     * Deposit button is allowed because its action
     * is simply to open PaymentElement.
     */
    if (!lastUsed) {
      return true;
    }

    /**
     * Saved method needs a valid methods session.
     */
    if (!methodsSession) {
      return false;
    }

    // /**
    //  * Saved card additionally requires CVC widget.
    //  */
    // if (requiresCvc) {
    //   return cvcReady;
    // }

    return true;
  })();

  return (
    <FormLayout
      {...props}
      buttonSlot={walletButton}
      walletReady={true}
      message={message}
      setMessage={setMessage}
      loading={overlayLoading}
      cvcSlot={cvcElement}
      cvcReady={cvcReady}
      requiresCvc={requiresCvc}
      paymentSlot={
        <PaymentElement
          widgetId="payment-element-id"
          ref={paymentRef}
          options={PAYMENT_ELEMENT_OPTIONS}
          onPaymentResult={handlePaymentResult}
          onChange={handlePaymentElementChange}
          onReady={() => {
            /**
             * onReady tells us the native widget exists,
             * but we intentionally DO NOT enable confirm here.
             *
             * Confirm is enabled only after
             * PAYMENT_METHOD_STATUS.
             */
            console.log("[Example] PaymentElement onReady");
          }}
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      }
      paymentElementReady={paymentElementReady}
      lastUsed={lastUsed}
      methodsSession={methodsSession}
      loadingSaved={loadingSaved}
      canSubmit={canSubmit}
      amount={amount}
      updateAmount={updateAmount}
      widgets={widgets}
    />
  );
}

const styles = StyleSheet.create({
  walletWrapper: {
    width: "100%",
    height: 48,
  },

  walletOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    borderRadius: 8,
  },
});
