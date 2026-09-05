/* TypeScript file generated from CardForm.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as React from 'react';

import * as CardFormJS from './CardForm.bs.js';

import type {appearance as VaultFormOptions_appearance} from './VaultFormOptions.gen';

import type {cardFormChange as VaultPublicState_cardFormChange} from './VaultPublicState.gen';

import type {cardFormEvent as VaultPublicState_cardFormEvent} from './VaultPublicState.gen';

import type {cardholderNameMode as CardFieldOptions_cardholderNameMode} from './CardFieldOptions.gen';

import type {customEndpoints as VaultEndpoint_customEndpoints} from './VaultEndpoint.gen';

import type {eligibilityConfig as VaultFormOptions_eligibilityConfig} from './VaultFormOptions.gen';

import type {localisation as VaultFormOptions_localisation} from './VaultFormOptions.gen';

import type {vaultDetails as VaultDetails_vaultDetails} from './VaultDetails.gen';

import type {vaultEnvironment as VaultFormOptions_vaultEnvironment} from './VaultFormOptions.gen';

import type {vaultSession as VaultFormOptions_vaultSession} from './VaultFormOptions.gen';

export type widgetHandle = {
  readonly focus: () => void; 
  readonly blur: () => void; 
  readonly clear: () => void
};

export type Props = {
  readonly accessible?: boolean; 
  readonly appearance?: VaultFormOptions_appearance; 
  readonly cardholderName?: CardFieldOptions_cardholderNameMode; 
  readonly children: React.ReactNode; 
  readonly customEndpoints?: VaultEndpoint_customEndpoints; 
  readonly disabled?: boolean; 
  readonly eligibility?: VaultFormOptions_eligibilityConfig; 
  readonly enabledCardSchemes?: string[]; 
  readonly environment: VaultFormOptions_vaultEnvironment; 
  readonly locale?: string; 
  readonly localisation?: VaultFormOptions_localisation; 
  readonly onChange?: (_1:VaultPublicState_cardFormChange) => void; 
  readonly onReady?: (_1:VaultPublicState_cardFormEvent) => void; 
  readonly sdkAuthorization?: string; 
  readonly session?: VaultFormOptions_vaultSession; 
  readonly unstyled?: boolean; 
  readonly vaultDetails?: VaultDetails_vaultDetails
};

export const make: React.ComponentType<{
  readonly accessible?: boolean; 
  readonly appearance?: VaultFormOptions_appearance; 
  readonly cardholderName?: CardFieldOptions_cardholderNameMode; 
  readonly children: React.ReactNode; 
  readonly customEndpoints?: VaultEndpoint_customEndpoints; 
  readonly disabled?: boolean; 
  readonly eligibility?: VaultFormOptions_eligibilityConfig; 
  readonly enabledCardSchemes?: string[]; 
  readonly environment: VaultFormOptions_vaultEnvironment; 
  readonly locale?: string; 
  readonly localisation?: VaultFormOptions_localisation; 
  readonly onChange?: (_1:VaultPublicState_cardFormChange) => void; 
  readonly onReady?: (_1:VaultPublicState_cardFormEvent) => void; 
  readonly sdkAuthorization?: string; 
  readonly session?: VaultFormOptions_vaultSession; 
  readonly unstyled?: boolean; 
  readonly vaultDetails?: VaultDetails_vaultDetails
}> = CardFormJS.make as any;
