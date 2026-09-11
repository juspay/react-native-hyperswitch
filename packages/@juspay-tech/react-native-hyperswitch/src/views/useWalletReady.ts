import { useEffect, useRef } from 'react';
import {
  useOptionalPaymentSession,
  useOptionalWalletSession,
} from '../context/HyperElements';
import type { PaymentSession } from '../types/definitions';
import type { PaymentResult } from '../types/paymentresult';
import type { WalletName, WalletSessionHandle } from '../types/walletSession';

export type WalletReadyOptions = {
  wallet: WalletName;
  label: string;
  session?: PaymentSession;
  onReady?: () => void;
  onLoadError?: (error: PaymentResult) => void;
};

/**
 * Resolves wallet eligibility for a button, then calls `onReady` once when the
 * wallet is pressable or `onLoadError` once when it is not. Exactly one of them
 * fires per intent. The button owns this — merchants never load the wallet
 * session themselves.
 *
 * Inside `<HyperElements>` the shared session is reused, so several buttons
 * resolve off one round trip. With an explicit `session` prop the button
 * resolves against that session directly.
 */
export function useWalletReady({
  wallet,
  label,
  session,
  onReady,
  onLoadError,
}: WalletReadyOptions): void {
  const contextSession = useOptionalPaymentSession();
  const { walletSession, load } = useOptionalWalletSession();

  const onReadyRef = useRef(onReady);
  const onLoadErrorRef = useRef(onLoadError);
  const walletSessionRef = useRef(walletSession);
  const loadRef = useRef(load);

  useEffect(() => {
    onReadyRef.current = onReady;
    onLoadErrorRef.current = onLoadError;
    walletSessionRef.current = walletSession;
    loadRef.current = load;
  }, [onReady, onLoadError, walletSession, load]);

  useEffect(() => {
    let cancelled = false;

    const fail = (type: string, message: string) => {
      onLoadErrorRef.current?.({ status: 'failed', type, message });
    };

    const resolveWallets = async (): Promise<WalletSessionHandle | null> => {
      if (session) {
        return session.getWalletSession();
      }
      if (walletSessionRef.current) {
        return walletSessionRef.current;
      }
      if (contextSession) {
        return loadRef.current();
      }
      return null;
    };

    const resolveEligibility = async () => {
      try {
        const wallets = await resolveWallets();
        if (cancelled) {
          return;
        }

        if (!wallets) {
          fail(
            'no_session',
            `${label} has no payment session. Pass a "session" prop or render it inside <HyperElements>.`
          );
          return;
        }

        const eligible = await wallets.isWalletEligible(wallet);
        if (cancelled) {
          return;
        }

        if (eligible) {
          onReadyRef.current?.();
        } else {
          fail('not_eligible', `${label} is not eligible for this payment.`);
        }
      } catch (e) {
        if (cancelled) {
          return;
        }
        fail('launch_failed', e instanceof Error ? e.message : String(e));
      }
    };

    void resolveEligibility();

    return () => {
      cancelled = true;
    };
  }, [session, contextSession, wallet, label]);
}
