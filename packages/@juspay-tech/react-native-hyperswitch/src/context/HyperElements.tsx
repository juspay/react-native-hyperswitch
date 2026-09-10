import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type {
  HyperswitchConfiguration,
  HyperswitchSession,
  PaymentSession,
  PaymentSessionConfiguration,
} from '../types/definitions';
import type { Elements } from '../types/elements';
import type { WalletSessionHandle } from '../types/walletSession';

export type WalletEligibility = {
  googlePay: boolean;
  applePay: boolean;
};

interface HyperElementsContext {
  paymentSession: PaymentSession | null;
  walletSession: WalletSessionHandle | null;
  walletEligibility: WalletEligibility;
  walletLoading: boolean;
  loadWalletSession: () => Promise<WalletSessionHandle | null>;
  elements: Elements | null;
  publishableKey: string | null;
  sdkAuthorization: string | null;
  hyperswitchConfig: HyperswitchConfiguration | null;
  paymentSessionConfig: PaymentSessionConfiguration | null;
  loading: boolean;
  error: Error | null;
}

const HyperElementsContext = createContext<HyperElementsContext | undefined>(
  undefined
);

HyperElementsContext.displayName = 'HyperElementsContext';

export interface HyperElementsProps {
  hyper: HyperswitchSession | Promise<HyperswitchSession> | null;
  options: { sdkAuthorization: string };
  children: ReactNode;
}

export function HyperElements({
  hyper,
  options,
  children,
}: HyperElementsProps) {
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(
    null
  );
  const [elements, setElements] = useState<Elements | null>(null);
  const [hyperswitchConfig, setHyperswitchConfig] =
    useState<HyperswitchConfiguration | null>(null);
  const [paymentSessionConfig, setPaymentSessionConfig] =
    useState<PaymentSessionConfiguration | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [sdkAuthorization, setSdkAuthorization] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [walletSession, setWalletSession] = useState<WalletSessionHandle | null>(
    null
  );
  const [walletEligibility, setWalletEligibility] = useState<WalletEligibility>({
    googlePay: false,
    applePay: false,
  });
  const [walletLoading, setWalletLoading] = useState(false);

  const loadWalletSession = useCallback(async () => {
    if (!paymentSession) {
      return null;
    }
    setWalletLoading(true);
    try {
      const wallets = await paymentSession.getWalletSession();
      const [googlePay, applePay] = await Promise.all([
        wallets.isGooglePayEligible(),
        wallets.isApplePayEligible(),
      ]);
      setWalletSession(wallets);
      setWalletEligibility({ googlePay, applePay });
      return wallets;
    } catch {
      setWalletSession(null);
      setWalletEligibility({ googlePay: false, applePay: false });
      return null;
    } finally {
      setWalletLoading(false);
    }
  }, [paymentSession]);

  useEffect(() => {
    setWalletSession(null);
    setWalletEligibility({ googlePay: false, applePay: false });
  }, [paymentSession]);

  useEffect(() => {
    if (!hyper) return;

    let cancelled = false;

    (async () => {
      try {
        const session = await Promise.resolve(hyper);
        const sessionConfig = {
          sdkAuthorization: options.sdkAuthorization,
        };
        const els = await session.elements(sessionConfig);

        if (!cancelled) {
          setPaymentSession({
            ...els,
          } as PaymentSession);
          setHyperswitchConfig(els.hyperswitchConfig);
          setPaymentSessionConfig(sessionConfig);
          setElements(els);
          setPublishableKey(session.publishableKey ?? null);
          setSdkAuthorization(options.sdkAuthorization ?? null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hyper, options.sdkAuthorization]);

  return (
    <HyperElementsContext.Provider
      value={{
        paymentSession,
        walletSession,
        walletEligibility,
        walletLoading,
        loadWalletSession,
        elements,
        publishableKey,
        sdkAuthorization,
        loading,
        error,
        paymentSessionConfig,
        hyperswitchConfig,
      }}
    >
      {children}
    </HyperElementsContext.Provider>
  );
}

export function useHyperElementsContext(): HyperElementsContext {
  const ctx = useContext(HyperElementsContext);
  if (ctx === undefined) {
    throw new Error(
      'useHyperElementsContext must be used inside <HyperElements>'
    );
  }
  return ctx;
}

export type UseWalletSessionResult = {
  walletSession: WalletSessionHandle | null;
  isGooglePayEligible: boolean;
  isApplePayEligible: boolean;
  loading: boolean;
  load: () => Promise<WalletSessionHandle | null>;
};

export function useWalletSession(): UseWalletSessionResult {
  const ctx = useHyperElementsContext();
  return {
    walletSession: ctx.walletSession,
    isGooglePayEligible: ctx.walletEligibility.googlePay,
    isApplePayEligible: ctx.walletEligibility.applePay,
    loading: ctx.walletLoading,
    load: ctx.loadWalletSession,
  };
}

export function useOptionalWalletSession(): UseWalletSessionResult {
  const ctx = useContext(HyperElementsContext);
  return {
    walletSession: ctx?.walletSession ?? null,
    isGooglePayEligible: ctx?.walletEligibility.googlePay ?? false,
    isApplePayEligible: ctx?.walletEligibility.applePay ?? false,
    loading: ctx?.walletLoading ?? false,
    load: ctx?.loadWalletSession ?? (async () => null),
  };
}

export function useOptionalPaymentSession(): PaymentSession | null {
  const ctx = useContext(HyperElementsContext);
  return ctx?.paymentSession ?? null;
}

export function usePaymentSession(): PaymentSession | null {
  const ctx = useHyperElementsContext();
  return ctx.paymentSession;
}

export function useElements(): Elements | null {
  const ctx = useHyperElementsContext();
  return ctx.elements;
}
