import './jsx-global';
import type * as React from 'react';
import {
  make as RawCardForm,
  type Props as ProviderProps,
  type widgetHandle,
} from './CardForm.gen';
import { make as RawCardNumberField, type Props as CardNumberProps } from './CardNumberField.gen';
import { make as RawCardExpiryField, type Props as CardExpiryProps } from './CardExpiryField.gen';
import { make as RawCardCVCField, type Props as CardCvcProps } from './CardCVCField.gen';
import {
  make as RawCardholderNameField,
  type Props as CardholderNameProps,
} from './CardholderNameField.gen';
import type { paymentConfirmInput as VaultPaymentConfirmInputInternal } from './VaultFormCoordinator.gen';
import type { safeVaultError as SafeVaultErrorInternal } from './VaultResult.gen';
import type { safeNextAction as SafeNextActionInternal } from './VaultNavigation.gen';
import type { confirmTokenMode as VaultConfirmTokenModeInternal } from './VaultConfirmBody.gen';
import type { MerchantSession as MerchantSessionInternal } from './merchantTypes';
import type { VaultField, VaultTokenizeResult } from './public';

export type HostFormHandle = {

  tokenize(): Promise<VaultTokenizeResult>;

  confirmPayment(input: VaultPaymentConfirmInput): Promise<VaultPaymentResult>;
  reset(): void;
  focus(field: VaultField): void;
};

export type VaultPaymentCardSource =
  | {
      readonly type_: 'vault';
      readonly session: MerchantSessionInternal;
      readonly confirmTokenMode?: VaultConfirmTokenModeInternal;
    }
  | { readonly type_: 'direct' };

export type VaultPaymentConfirmInput = Omit<VaultPaymentConfirmInputInternal, 'cardSource'> & {
  readonly cardSource: VaultPaymentCardSource;
};

export type VaultCardholderNameMode = 'collect' | 'external' | 'omit';

export type VaultPaymentResult =
  | { readonly status: 'succeeded' }
  | { readonly status: 'processing' }
  | { readonly status: 'requires_customer_action'; readonly nextAction: SafeNextActionInternal }
  | { readonly status: 'failed'; readonly error: SafeVaultErrorInternal }
  | { readonly status: 'validation_error'; readonly error: SafeVaultErrorInternal };

export type CardFormProps = ProviderProps;

export const CardForm =
  RawCardForm as unknown as React.ForwardRefExoticComponent<
    ProviderProps & React.RefAttributes<HostFormHandle>
  >;

type VaultFieldComponent<P> = React.ForwardRefExoticComponent<P & React.RefAttributes<widgetHandle>>;

export const CardNumberField = RawCardNumberField as unknown as VaultFieldComponent<CardNumberProps>;
export const CardExpiryField = RawCardExpiryField as unknown as VaultFieldComponent<CardExpiryProps>;
export const CardCVCField = RawCardCVCField as unknown as VaultFieldComponent<CardCvcProps>;
export const CardholderNameField =
  RawCardholderNameField as unknown as VaultFieldComponent<CardholderNameProps>;

export type {
  localisation as VaultFormLocalisation,
  localisationMessages as VaultFormValidationMessages,
  safeVaultError as SafeVaultError,
  safeVaultErrorCode as SafeVaultErrorCode,
} from './VaultFormOptions.gen';

export type { vaultPaymentStatus as VaultPaymentStatus, safeVaultErrorType as SafeVaultErrorType } from './VaultResult.gen';

export type { cardSourceType as VaultCardSourceType } from './VaultCardSource.gen';

export type { eligibilityConfig as VaultEligibilityConfig } from './VaultFormOptions.gen';

export type {
  hostPaymentMethodData as VaultHostPaymentMethodData,
  hostBilling as VaultHostBilling,
  hostBillingAddress as VaultHostBillingAddress,
  hostPhone as VaultHostPhone,
} from './VaultPaymentMethodData.gen';

export type {
  confirmTokenMode as VaultConfirmTokenMode,
  paymentMethodType as VaultPaymentMethodType,
  paymentType as VaultPaymentType,
  acceptanceType as VaultAcceptanceType,
  hostBrowserInfo as VaultHostBrowserInfo,
  hostCustomerAcceptance as VaultHostCustomerAcceptance,
  hostOnlineAcceptance as VaultHostOnlineAcceptance,
} from './VaultConfirmBody.gen';

export type {
  nextActionType as VaultNextActionType,
  safeNextAction as VaultNextAction,
  safeThreeDs as VaultThreeDsData,
  safeDdc as VaultDdcData,
  safeSessionToken as VaultSessionTokenData,
} from './VaultResult.gen';

export type {
  vaultEligibilityStatus as VaultEligibilityStatus,
  fieldChange as VaultFieldChange,
  vaultFormFields as VaultFormFields,
  cardFormChange as VaultCardFormChange,
} from './VaultPublicState.gen';

export type {
  VaultField,
  VaultTokenizeResult,
  VaultTokenizedCard,
  VaultTokenizeStatus,
  VaultFieldHandle,
  VaultFieldEvent,
  VaultCardFormEvent,
  VaultCardDetails,
  VaultFieldStyles,
  VaultCardExpiryStyles,
  VaultFormFieldStyles,
  VaultLabelBehavior,
  VaultErrorDisplay,
  VaultCVCIconDisplay,
  VaultCardBrandIcon,
  VaultFieldOptions,
  VaultCardNumberOptions,
  VaultCardExpiryOptions,
  VaultCardCVCOptions,
  VaultCardholderNameOptions,
  VaultFormFieldOptions,
  VaultSavedCard,
  VaultFormAppearance,
  VaultFormAppearanceVariables,
  VaultFormLabels,
  VaultEnvironment,
  VaultEndpointConfig,
  MerchantSession,
  VaultDetails,
  VaultData,
  VaultElementType,
  VaultCardBrand,
  VaultFieldErrorCode,
  VaultFieldError,
  VaultSessionStatus,
} from './public';
