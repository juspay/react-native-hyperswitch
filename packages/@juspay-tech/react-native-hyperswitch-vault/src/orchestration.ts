import type { orchestrationConfirmInput } from './VaultOrchestration.gen';
import type { providerTokenizedCard } from './VaultConfirmBody.gen';
import type { VaultPaymentResult } from './host';

export type ProviderTokenizedCard = providerTokenizedCard;

export type OrchestrationConfirmInput = orchestrationConfirmInput;

export declare const confirmTokenizedCardPayment: (
  input: OrchestrationConfirmInput
) => Promise<VaultPaymentResult>;

export type {
  VaultPaymentResult,
  VaultPaymentStatus,
  SafeVaultError,
  SafeVaultErrorCode,
  SafeVaultErrorType,
  VaultEnvironment,
  VaultEndpointConfig,
  VaultHostPaymentMethodData,
  VaultHostBilling,
  VaultHostBillingAddress,
  VaultHostPhone,
  VaultPaymentMethodType,
  VaultPaymentType,
  VaultAcceptanceType,
  VaultHostBrowserInfo,
  VaultHostCustomerAcceptance,
  VaultHostOnlineAcceptance,
  VaultNextActionType,
  VaultNextAction,
  VaultThreeDsData,
  VaultDdcData,
  VaultSessionTokenData,
} from './host';
