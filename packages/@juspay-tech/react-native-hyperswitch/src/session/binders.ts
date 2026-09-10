import type {
  HyperswitchConfiguration,
  PaymentSessionConfiguration,
} from '../types/definitions';
import type { PaymentResult } from '../types/paymentresult';
import type { PaymentSheetConfiguration } from '../types/PaymentSheetConfiguration';
import type {
  CustomerSavedPaymentMethodsSession,
  SavedPaymentMethodsConfiguration,
} from '../types/savedPaymentMethods';
import { buildPresentPaymentSheetPayload } from '../utils/LaunchOptions';
import { presentPaymentSheetWithPayload } from './presentPaymentSheet';
import { getCustomerSavedPaymentMethods } from './SavedPaymentMethods';
import { getWalletSession } from './WalletSession';
import type { WalletSessionHandle } from '../types/walletSession';

/** Options captured by every session-style factory (PaymentSession + Elements). */
type SessionBindings = {
  hyperswitchConfig: HyperswitchConfiguration;
  paymentSessionConfig: PaymentSessionConfiguration;
};

/**
 * Shared `presentPaymentSheet` implementation used by both
 * `PaymentSession` and `Elements` so sheet-presentation behavior cannot
 * drift between the two surfaces.
 */
export function bindPresentPaymentSheet(bindings: SessionBindings) {
  return async function presentPaymentSheet(
    configuration?: PaymentSheetConfiguration
  ): Promise<PaymentResult> {
    const payload = buildPresentPaymentSheetPayload(
      bindings.hyperswitchConfig,
      bindings.paymentSessionConfig,
      configuration
    );
    return presentPaymentSheetWithPayload(payload);
  };
}

/**
 * Shared `getCustomerSavedPaymentMethods` implementation used by both
 * `PaymentSession` and `Elements`.
 */
export function bindGetCustomerSavedPaymentMethods(bindings: SessionBindings) {
  return function getSaved(
    configuration?: SavedPaymentMethodsConfiguration
  ): Promise<CustomerSavedPaymentMethodsSession> {
    return getCustomerSavedPaymentMethods(
      bindings.hyperswitchConfig,
      bindings.paymentSessionConfig,
      configuration
    );
  };
}

export function bindGetWalletSession(bindings: SessionBindings) {
  return function getWallets(): Promise<WalletSessionHandle> {
    return getWalletSession(
      bindings.hyperswitchConfig,
      bindings.paymentSessionConfig
    );
  };
}
