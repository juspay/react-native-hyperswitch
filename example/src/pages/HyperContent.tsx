import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

import {
  ApplePayButton,
  CardCVCElement,
  GooglePayButton,
  PaymentElement,
  SubscriptionEvent,
  useHyperswitchDeviceCapability,
  usePaymentSession,
  useWidgets,
  type CustomerLastUsedPaymentMethod,
  type CustomerSavedPaymentMethodsSession,
  type PaymentElementHandle,
  type PaymentEventResult,
  type PaymentResult,
} from "@juspay-tech/react-native-hyperswitch";

import { FormLayout } from "./FormLayout";
import { initialBaseUrl, secretKey, serverURL } from "../utils";

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

const WALLET_BUTTON_APPEARANCE = {
  primaryButton: {
    height: 58,
    borderRadius: 12,
  },
};

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
    "FORM_STATUS",
  ] as SubscriptionEvent[],
};

export function HyperContent(props: SharedProps) {
  const { amount, paymentId, onClose, setSdkAuthorization, isAmountScreen } =
    props;

  const paymentSession = usePaymentSession();
  const widgets = useWidgets();
  

  /**
   * useHyperswitchWallets() (session/merchant-accurate eligibility) always
   * resolves {} until the PreFetch embedded-module resolver is wired up
   * (see session/WalletEligibilityBridge.ts) — using it here would hide
   * the wallet buttons this demo exists to exercise. The example therefore
   * gates on device capability only, same as production apps should until
   * that lands.
   */
  const {
    isLoading: walletsSupportLoading,
    isGooglePayCapable,
    isApplePayCapable,
  } = useHyperswitchDeviceCapability();

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

  const [walletReady, setWalletReady] = useState(false);

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
    setWalletReady(false);
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

    void loadSavedPaymentMethods();

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

  const handleWalletChange = useCallback((event: PaymentEventResult) => {
    console.log(
      `[Example] ${
        Platform.OS === "ios" ? "ApplePayButton" : "GooglePayButton"
      } onChange:`,
      JSON.stringify(event),
    );

    if (event.eventName !== "PAYMENT_METHOD_STATUS") {
      return;
    }

    console.log(
      "[Example] Wallet button ready from PAYMENT_METHOD_STATUS",
      JSON.stringify(event.payload),
    );

    setWalletReady(true);
  }, []);

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

    // setOverlayLoading(true);
    setMessage("");

    try {
      await paymentSession.updateIntent(async () => {
        const controller = new AbortController();

        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
          const serverUrl = serverURL;
          const url = initialBaseUrl
            ? `${initialBaseUrl}/update-payment`
            : undefined;
          const response = await fetch(
            `${serverUrl ? `${serverUrl}/${paymentId}` : url}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Api-Key": secretKey,
              },

              body: JSON.stringify({
                payment_id: paymentId,
                amount: amount * 100,
              }),

              signal: controller.signal,
            },
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data?.error ?? "Update failed");
          }
          return {
            sdkAuthorization: data.sdkAuthorization || "",
          };
        } catch (e: any) {
          console.log(e.message);
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
      // setOverlayLoading(false);
    }
  }, [paymentSession, paymentId, amount, setSdkAuthorization]);

  /**
   * useHyperswitchDeviceCapability() decides *whether* to render a wallet
   * button at all (device capability only — see the note above on why the
   * demo doesn't also gate on useHyperswitchWallets()' session-based
   * eligibility yet). walletReady (via handleWalletChange) separately
   * tracks whether the already-mounted native widget has become
   * interactive — the two are intentionally independent.
   */
  const walletButton = walletsSupportLoading
    ? null
    : Platform.OS === "ios" && isApplePayCapable
      ? (
          <ApplePayButton
            widgetId="apple-pay-button"
            options={{
              merchantDisplayName: "Hyperswitch Example",
              appearance: {
                ...WALLET_BUTTON_APPEARANCE,
              },
              subscribedEvents: ["PAYMENT_METHOD_STATUS"],
            }}
            onChange={handleWalletChange}
            onPaymentResult={handlePaymentResult}
          />
        )
      : Platform.OS === "android" && isGooglePayCapable
        ? (
            <GooglePayButton
              widgetId="google-pay-button"
              options={{
                merchantDisplayName: "Hyperswitch Example",
                appearance: {
                  ...WALLET_BUTTON_APPEARANCE,
                },
                subscribedEvents: ["PAYMENT_METHOD_STATUS"],
              }}
              onChange={handleWalletChange}
              onPaymentResult={handlePaymentResult}
            />
          )
        : null;

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
      walletReady={walletReady}
      walletsCheckLoading={walletsSupportLoading}
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
