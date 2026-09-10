import { useRef } from 'react';
import {
  useOptionalPaymentSession,
  useOptionalWalletSession,
} from '../context/HyperElements';
import type { PaymentSession } from '../types/definitions';
import type { PaymentResult } from '../types/paymentresult';
import type { WalletName } from '../types/walletSession';

export type WalletLaunchOptions = {
  wallet: WalletName;
  label: string;
  session?: PaymentSession;
  onPaymentResult?: (result: PaymentResult) => void;
};

export function useWalletLaunch({
  wallet,
  label,
  session,
  onPaymentResult,
}: WalletLaunchOptions): () => Promise<void> {
  const contextSession = useOptionalPaymentSession();
  const { walletSession, load } = useOptionalWalletSession();
  const inFlight = useRef(false);

  return async () => {
    const activeSession = session ?? contextSession;

    if (!activeSession && !walletSession) {
      const error = new Error(
        `${label} was pressed without a payment session. Pass a "session" prop or render it inside <HyperElements>.`
      );
      if (!onPaymentResult) {
        throw error;
      }
      onPaymentResult({
        status: 'failed',
        type: 'no_session',
        message: error.message,
      });
      return;
    }

    if (inFlight.current) {
      const error = new Error(
        `${label} is already processing a payment. Ignoring this press.`
      );
      if (!onPaymentResult) {
        throw error;
      }
      onPaymentResult({
        status: 'failed',
        type: 'already_in_progress',
        message: error.message,
      });
      return;
    }
    inFlight.current = true;

    try {
      const wallets =
        walletSession ??
        (await load()) ??
        (await activeSession!.getWalletSession());

      const eligible = await wallets.isWalletEligible(wallet);
      if (!eligible) {
        const error = new Error(
          `${label} is not eligible for this payment.`
        );
        if (!onPaymentResult) {
          throw error;
        }
        onPaymentResult({
          status: 'failed',
          type: 'not_eligible',
          message: error.message,
        });
        return;
      }

      const result = await wallets.launchWallet(wallet);
      onPaymentResult?.(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!onPaymentResult) {
        throw e;
      }
      onPaymentResult({
        status: 'failed',
        type: 'launch_failed',
        message,
      });
    } finally {
      inFlight.current = false;
    }
  };
}
