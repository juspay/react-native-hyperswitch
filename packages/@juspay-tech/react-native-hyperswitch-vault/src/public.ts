import './jsx-global';
import type * as React from 'react';
import { make as RawHyperswitchVaultForm, type Props as FormPropsInternal } from './HyperswitchVaultForm.gen';
import {
  make as RawCardForm,
  type Props as ProviderPropsInternal,
  type widgetHandle,
} from './CardForm.gen';
import { make as RawCardNumberField, type Props as CardNumberPropsInternal } from './CardNumberField.gen';
import { make as RawCardExpiryField, type Props as CardExpiryPropsInternal } from './CardExpiryField.gen';
import { make as RawCardCVCField, type Props as CardCvcPropsInternal } from './CardCVCField.gen';
import {
  make as RawCardholderNameField,
  type Props as CardholderNamePropsInternal,
} from './CardholderNameField.gen';
import type { fieldStyles, expiryStyles, formFieldStyles } from './CardFieldStyles.gen';
import type {
  labelBehavior,
  errorDisplay,
  brandIconMode as fieldBrandIconMode,
  cvcIconDisplay,
  fieldOptions,
  cardNumberOptions,
  expiryOptions,
  cvcOptions,
  cardholderNameOptions,
  formFieldOptions,
  formLayout,
  fieldArrangement,
  savedCard,
} from './CardFieldOptions.gen';
import type {
  localisation as LocalisationInternal,
  localisationMessages as LocalisationMessagesInternal,
} from './VaultFormOptions.gen';
import type {
  fieldEvent,
  fieldChange as FieldChangeInternal,
  cardFormEvent,
  cardFormChange as CardFormChangeInternal,
  vaultFormFields as VaultFormFieldsInternal,
  cardDetails,
} from './VaultPublicState.gen';

export type VaultField = 'cardNumber' | 'cardExpiry' | 'cardCvc' | 'cardholderName';

export type SafeVaultErrorType = 'validation_error' | 'api_error' | 'card_error';

export type SafeVaultErrorCode =
  | 'validation_error'
  | 'incomplete_field_set'
  | 'session_expired'
  | 'session_consumed'
  | 'confirm_in_progress'
  | 'tokenization_failed'
  | 'invalid_session'
  | 'unsupported_configuration'
  | 'unknown_outcome';

export type SafeVaultError = {
  readonly code: SafeVaultErrorCode;
  readonly message: string;
  readonly type: SafeVaultErrorType;
};

export type VaultTokenizedCard = {
  readonly bin?: string;
  readonly last4: string;
  readonly brand?: string;
  readonly expiryMonth: string;
  readonly expiryYear: string;
};

export type VaultTokenizeResult =
  | { readonly status: 'success'; readonly token: string; readonly card?: VaultTokenizedCard }
  | { readonly status: 'validation_error'; readonly error: SafeVaultError }
  | { readonly status: 'error'; readonly error: SafeVaultError };

export type VaultFormHandleShape = {

  tokenize(): Promise<VaultTokenizeResult>;
  reset(): void;
  focus(field: VaultField): void;
};

export type VaultCardholderNameMode = 'collect' | 'omit';

export type VaultFormValidationMessages = Omit<LocalisationMessagesInternal, 'cardNotEligible'>;
export type VaultFormLocalisation = Omit<LocalisationInternal, 'validationMessages'> & {
  readonly validationMessages?: VaultFormValidationMessages;
};

export type VaultFieldEvent = fieldEvent;

export type VaultFieldChange = Omit<FieldChangeInternal, 'eligibility'>;

export type VaultFormFields = Omit<VaultFormFieldsInternal, 'cardNumber'> & {
  readonly cardNumber: VaultFieldChange;
};

export type VaultCardDetails = cardDetails;

export type VaultCardFormEvent = cardFormEvent;

export type VaultCardFormChange = Omit<CardFormChangeInternal, 'eligibility' | 'fields'> & {
  readonly fields: VaultFormFields;
};

type MerchantProps<P> = Omit<P, 'eligibility' | 'cardholderName' | 'localisation' | 'onChange'> & {
  readonly cardholderName?: VaultCardholderNameMode;
  readonly localisation?: VaultFormLocalisation;
  readonly onChange?: (event: VaultCardFormChange) => void;
};

export type CardFormProps = MerchantProps<ProviderPropsInternal>;
export type HyperswitchVaultFormProps = MerchantProps<FormPropsInternal>;

type FieldProps<P> = Omit<P, 'onChange'> & {
  readonly onChange?: (event: VaultFieldChange) => void;
};

export type CardNumberFieldProps = FieldProps<CardNumberPropsInternal>;
export type CardExpiryFieldProps = FieldProps<CardExpiryPropsInternal>;
export type CardCVCFieldProps = FieldProps<CardCvcPropsInternal>;
export type CardholderNameFieldProps = FieldProps<CardholderNamePropsInternal>;

type VaultFormComponent<P> = React.ForwardRefExoticComponent<
  P & React.RefAttributes<VaultFormHandleShape>
>;

type VaultFieldComponent<P> = React.ForwardRefExoticComponent<P & React.RefAttributes<widgetHandle>>;

export type VaultFieldHandle = widgetHandle;
export type VaultFormHandle = VaultFormHandleShape;
export type HyperswitchVaultFormHandle = VaultFormHandleShape;

export const CardForm = RawCardForm as unknown as VaultFormComponent<CardFormProps>;
export const HyperswitchVaultForm =
  RawHyperswitchVaultForm as unknown as VaultFormComponent<HyperswitchVaultFormProps>;

export const CardNumberField = RawCardNumberField as unknown as VaultFieldComponent<CardNumberFieldProps>;
export const CardExpiryField = RawCardExpiryField as unknown as VaultFieldComponent<CardExpiryFieldProps>;
export const CardCVCField = RawCardCVCField as unknown as VaultFieldComponent<CardCVCFieldProps>;

export const CardholderNameField =
  RawCardholderNameField as unknown as VaultFieldComponent<CardholderNameFieldProps>;

export type CardFormInstance = {

  readonly Form: React.ComponentType<Partial<CardFormProps> & { children: React.ReactNode }>;

  tokenize(): Promise<VaultTokenizeResult>;
  reset(): void;
  focus(field: VaultField): void;

  getState(): VaultCardFormChange | null;

  on(event: 'ready', listener: (event: VaultCardFormEvent) => void): () => void;
  on(event: 'change', listener: (event: VaultCardFormChange) => void): () => void;
};

export declare const createCardForm: (
  config?: Partial<Omit<CardFormProps, 'children'>>
) => CardFormInstance;

export type VaultFieldStyles = fieldStyles;
export type VaultCardNumberStyles = fieldStyles;
export type VaultCardExpiryStyles = expiryStyles;
export type VaultCardCVCStyles = fieldStyles;
export type VaultFormFieldStyles = formFieldStyles;

export type VaultLabelBehavior = labelBehavior;
export type VaultErrorDisplay = errorDisplay;
export type VaultCVCIconDisplay = cvcIconDisplay;

export type VaultCardBrandIcon = fieldBrandIconMode;

export type VaultFieldOptions = fieldOptions;
export type VaultCardNumberOptions = cardNumberOptions;
export type VaultCardExpiryOptions = expiryOptions;
export type VaultCardCVCOptions = cvcOptions;
export type VaultCardholderNameOptions = cardholderNameOptions;
export type VaultFormFieldOptions = formFieldOptions;
export type VaultSavedCard = savedCard;

export type VaultFormLayout = formLayout;
export type VaultFieldArrangement = fieldArrangement;

export type {
  localisationLabels as VaultFormLabels,
  appearance as VaultFormAppearance,
  appearanceVariables as VaultFormAppearanceVariables,
  vaultEnvironment as VaultEnvironment,
} from './VaultFormOptions.gen';

export type { vaultTokenizeStatus as VaultTokenizeStatus } from './VaultResult.gen';

export type { vaultEndpointConfig as VaultEndpointConfig } from './VaultEndpoint.gen';
export type {
  customEndpoints as VaultCustomEndpoints,
  overrideEndpointConfiguration as VaultOverrideEndpointConfiguration,
} from './VaultEndpoint.gen';

export type { MerchantSession } from './merchantTypes';

export type { vaultDetails as VaultDetails, vaultData as VaultData } from './VaultDetails.gen';

export type {
  elementType as VaultElementType,
  cardBrand as VaultCardBrand,
  vaultFieldErrorCode as VaultFieldErrorCode,
  vaultFieldError as VaultFieldError,
  vaultSessionStatus as VaultSessionStatus,
} from './VaultPublicState.gen';
