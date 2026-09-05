/* TypeScript file generated from HyperswitchVaultForm.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as React from 'react';

import * as HyperswitchVaultFormJS from './HyperswitchVaultForm.bs.js';

import type {appearance as VaultFormOptions_appearance} from './VaultFormOptions.gen';

import type {brandIconMode as VaultFormOptions_brandIconMode} from './VaultFormOptions.gen';

import type {cardFormChange as VaultPublicState_cardFormChange} from './VaultPublicState.gen';

import type {cardFormEvent as VaultPublicState_cardFormEvent} from './VaultPublicState.gen';

import type {cardSourceType as VaultCardSource_cardSourceType} from './VaultCardSource.gen';

import type {cardholderNameMode as CardFieldOptions_cardholderNameMode} from './CardFieldOptions.gen';

import type {customEndpoints as VaultEndpoint_customEndpoints} from './VaultEndpoint.gen';

import type {eligibilityConfig as VaultFormOptions_eligibilityConfig} from './VaultFormOptions.gen';

import type {expiryStyles as CardFieldStyles_expiryStyles} from './CardFieldStyles.gen';

import type {fieldArrangement as CardFieldOptions_fieldArrangement} from './CardFieldOptions.gen';

import type {fieldStyles as CardFieldStyles_fieldStyles} from './CardFieldStyles.gen';

import type {formFieldOptions as CardFieldOptions_formFieldOptions} from './CardFieldOptions.gen';

import type {formFieldStyles as CardFieldStyles_formFieldStyles} from './CardFieldStyles.gen';

import type {formLayout as CardFieldOptions_formLayout} from './CardFieldOptions.gen';

import type {localisationLabels as VaultFormOptions_localisationLabels} from './VaultFormOptions.gen';

import type {localisationMessages as VaultFormOptions_localisationMessages} from './VaultFormOptions.gen';

import type {localisation as VaultFormOptions_localisation} from './VaultFormOptions.gen';

import type {paymentCardSource as VaultCardSource_paymentCardSource} from './VaultCardSource.gen';

import type {safeVaultErrorCode as VaultResult_safeVaultErrorCode} from './VaultResult.gen';

import type {safeVaultError as VaultResult_safeVaultError} from './VaultResult.gen';

import type {vaultDetails as VaultDetails_vaultDetails} from './VaultDetails.gen';

import type {vaultEnvironment as VaultFormOptions_vaultEnvironment} from './VaultFormOptions.gen';

import type {vaultFormHandle as VaultFormOptions_vaultFormHandle} from './VaultFormOptions.gen';

import type {vaultPaymentResult as VaultResult_vaultPaymentResult} from './VaultResult.gen';

import type {vaultSession as VaultFormOptions_vaultSession} from './VaultFormOptions.gen';

import type {vaultTokenizeResult as VaultResult_vaultTokenizeResult} from './VaultResult.gen';

export type vaultEnvironment = VaultFormOptions_vaultEnvironment;

export type vaultSession = VaultFormOptions_vaultSession;

export type brandIconMode = VaultFormOptions_brandIconMode;

export type appearance = VaultFormOptions_appearance;

export type localisationLabels = VaultFormOptions_localisationLabels;

export type localisationMessages = VaultFormOptions_localisationMessages;

export type localisation = VaultFormOptions_localisation;

export type safeVaultErrorCode = VaultResult_safeVaultErrorCode;

export type safeVaultError = VaultResult_safeVaultError;

export type vaultPaymentResult = VaultResult_vaultPaymentResult;

export type vaultTokenizeResult = VaultResult_vaultTokenizeResult;

export type vaultFormHandle = VaultFormOptions_vaultFormHandle;

export type fieldStyles = CardFieldStyles_fieldStyles;

export type expiryStyles = CardFieldStyles_expiryStyles;

export type formFieldStyles = CardFieldStyles_formFieldStyles;

export type formFieldOptions = CardFieldOptions_formFieldOptions;

export type formLayout = CardFieldOptions_formLayout;

export type fieldArrangement = CardFieldOptions_fieldArrangement;

export type cardholderNameMode = CardFieldOptions_cardholderNameMode;

export type eligibilityConfig = VaultFormOptions_eligibilityConfig;

export type paymentCardSource = VaultCardSource_paymentCardSource;

export type cardSourceType = VaultCardSource_cardSourceType;

export type Props = {
  readonly accessible?: boolean; 
  readonly appearance?: appearance; 
  readonly cardholderName?: cardholderNameMode; 
  readonly customEndpoints?: VaultEndpoint_customEndpoints; 
  readonly disabled?: boolean; 
  readonly eligibility?: eligibilityConfig; 
  readonly enabledCardSchemes?: string[]; 
  readonly environment: vaultEnvironment; 
  readonly fieldArrangement?: fieldArrangement; 
  readonly fieldOptions?: formFieldOptions; 
  readonly fieldStyles?: formFieldStyles; 
  readonly layout?: formLayout; 
  readonly locale?: string; 
  readonly localisation?: localisation; 
  readonly onChange?: (_1:VaultPublicState_cardFormChange) => void; 
  readonly onReady?: (_1:VaultPublicState_cardFormEvent) => void; 
  readonly sdkAuthorization?: string; 
  readonly session?: vaultSession; 
  readonly unstyled?: boolean; 
  readonly vaultDetails?: VaultDetails_vaultDetails
};

export const make: React.ComponentType<{
  readonly accessible?: boolean; 
  readonly appearance?: appearance; 
  readonly cardholderName?: cardholderNameMode; 
  readonly customEndpoints?: VaultEndpoint_customEndpoints; 
  readonly disabled?: boolean; 
  readonly eligibility?: eligibilityConfig; 
  readonly enabledCardSchemes?: string[]; 
  readonly environment: vaultEnvironment; 
  readonly fieldArrangement?: fieldArrangement; 
  readonly fieldOptions?: formFieldOptions; 
  readonly fieldStyles?: formFieldStyles; 
  readonly layout?: formLayout; 
  readonly locale?: string; 
  readonly localisation?: localisation; 
  readonly onChange?: (_1:VaultPublicState_cardFormChange) => void; 
  readonly onReady?: (_1:VaultPublicState_cardFormEvent) => void; 
  readonly sdkAuthorization?: string; 
  readonly session?: vaultSession; 
  readonly unstyled?: boolean; 
  readonly vaultDetails?: VaultDetails_vaultDetails
}> = HyperswitchVaultFormJS.make as any;
