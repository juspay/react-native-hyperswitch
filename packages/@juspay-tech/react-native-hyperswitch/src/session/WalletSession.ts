import NativeHyperswitchModule from '../codegen/modules/NativeHyperswitchModule';
import type {
  HyperswitchConfiguration,
  PaymentSessionConfiguration,
} from '../types/definitions';
import type { PaymentResult } from '../types/paymentresult';
import type {
  WalletName,
  WalletSessionHandle,
} from '../types/walletSession';
import { mapNativeResponseToPaymentResult } from '../native/NativeResponseMapper';

export function createWalletSession(): WalletSessionHandle {
  return {
    isWalletEligible(wallet: WalletName): Promise<boolean> {
      return NativeHyperswitchModule.isWalletEligible(wallet).catch(() => false);
    },

    isGooglePayEligible(): Promise<boolean> {
      return NativeHyperswitchModule.isWalletEligible('google_pay').catch(
        () => false
      );
    },

    isApplePayEligible(): Promise<boolean> {
      return NativeHyperswitchModule.isWalletEligible('apple_pay').catch(
        () => false
      );
    },

    async launchWallet(wallet: WalletName): Promise<PaymentResult> {
      const raw = await NativeHyperswitchModule.launchWallet(wallet);
      return mapNativeResponseToPaymentResult(raw);
    },

    async launchGooglePay(): Promise<PaymentResult> {
      const raw = await NativeHyperswitchModule.launchWallet('google_pay');
      return mapNativeResponseToPaymentResult(raw);
    },

    async launchApplePay(): Promise<PaymentResult> {
      const raw = await NativeHyperswitchModule.launchWallet('apple_pay');
      return mapNativeResponseToPaymentResult(raw);
    },
  };
}

const WALLET_SESSION_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${WALLET_SESSION_TIMEOUT_MS}ms`));
    }, WALLET_SESSION_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function getWalletSession(
  hyperswitchConfig: HyperswitchConfiguration,
  paymentSessionConfig: PaymentSessionConfiguration
): Promise<WalletSessionHandle> {
  const raw = await withTimeout(
    NativeHyperswitchModule.getWalletSession({
      hyperswitchConfig,
      paymentSessionConfig,
    }),
    'getWalletSession'
  );

  let status: string | undefined;
  let message: string | undefined;
  try {
    const parsed = JSON.parse(raw) as { status?: string; message?: string };
    status = parsed.status;
    message = parsed.message;
  } catch {
    status = undefined;
  }

  if (status === 'failed') {
    throw new Error(message ?? 'Failed to initialise the wallet session');
  }

  return createWalletSession();
}
