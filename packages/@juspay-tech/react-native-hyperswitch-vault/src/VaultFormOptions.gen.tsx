/* TypeScript file generated from VaultFormOptions.res by genType. */

/* eslint-disable */
/* tslint:disable */

import type {MerchantSession as $$vaultSession} from './merchantTypes';

import type {brandIconMode as CardIcons_brandIconMode} from './CardIcons.gen';

import type {elementType as VaultPublicState_elementType} from './VaultPublicState.gen';

import type {labelBehavior as CardFieldOptions_labelBehavior} from './CardFieldOptions.gen';

import type {paymentConfirmInput as VaultFormCoordinator_paymentConfirmInput} from './VaultFormCoordinator.gen';

import type {safeVaultErrorCode as VaultResult_safeVaultErrorCode} from './VaultResult.gen';

import type {safeVaultError as VaultResult_safeVaultError} from './VaultResult.gen';

import type {vaultEndpointConfig as VaultEndpoint_vaultEndpointConfig} from './VaultEndpoint.gen';

import type {vaultPaymentResult as VaultResult_vaultPaymentResult} from './VaultResult.gen';

import type {vaultTokenizeResult as VaultResult_vaultTokenizeResult} from './VaultResult.gen';

export type vaultEnvironment = "PROD" | "SANDBOX" | "INTEG";

export type vaultSession = $$vaultSession;

export type brandIconMode = CardIcons_brandIconMode;

export type appearanceVariables = {
  readonly colorPrimary?: string; 
  readonly colorText?: string; 
  readonly colorDanger?: string; 
  readonly colorTextPlaceholder?: string; 
  readonly colorBackground?: string; 
  readonly borderColor?: string; 
  readonly borderRadius?: number; 
  readonly fontFamily?: string; 
  readonly inputFieldHeight?: number; 
  readonly borderWidth?: number; 
  readonly gap?: number; 
  readonly fontScale?: number; 
  readonly placeholderTextSizeAdjust?: number; 
  readonly errorTextSizeAdjust?: number; 
  readonly errorMessageSpacing?: number; 
  readonly cardBrandIcon?: brandIconMode
};

export type appearance = { readonly variables?: appearanceVariables; readonly labels?: CardFieldOptions_labelBehavior };

export type localisationLabels = {
  readonly cardNumberPlaceholder?: string; 
  readonly cardNumberFloatingLabel?: string; 
  readonly expiryPlaceholder?: string; 
  readonly expiryFloatingLabel?: string; 
  readonly cvcPlaceholder?: string; 
  readonly cvcFloatingLabel?: string; 
  readonly cardholderNamePlaceholder?: string; 
  readonly cardholderNameFloatingLabel?: string; 
  readonly selectCardBrandLabel?: string
};

export type localisationMessages = {
  readonly cardNumberRequired?: string; 
  readonly cardNumberInvalid?: string; 
  readonly expiryRequired?: string; 
  readonly expiryInvalid?: string; 
  readonly cvcRequired?: string; 
  readonly cvcInvalid?: string; 
  readonly unsupportedCard?: string; 
  readonly cardNotEligible?: string
};

export type localisation = {
  readonly labels?: localisationLabels; 
  readonly validationMessages?: localisationMessages; 
  readonly isRtl?: boolean
};

export type safeVaultErrorCode = VaultResult_safeVaultErrorCode;

export type safeVaultError = VaultResult_safeVaultError;

export type vaultPaymentResult = VaultResult_vaultPaymentResult;

export type vaultTokenizeResult = VaultResult_vaultTokenizeResult;

export type paymentConfirmInput = VaultFormCoordinator_paymentConfirmInput;

export type vaultField = VaultPublicState_elementType;

export type eligibilityConfig = {
  readonly paymentId: string; 
  readonly sdkAuthorization?: string; 
  readonly publishableKey?: string; 
  readonly clientSecret?: string; 
  readonly appId?: string; 
  readonly endpoint?: VaultEndpoint_vaultEndpointConfig
};

export type vaultFormHandle = {
  readonly tokenize: () => Promise<vaultTokenizeResult>; 
  readonly confirmPayment: (_1:paymentConfirmInput) => Promise<vaultPaymentResult>; 
  readonly reset: () => void; 
  readonly focus: (_1:vaultField) => void
};
