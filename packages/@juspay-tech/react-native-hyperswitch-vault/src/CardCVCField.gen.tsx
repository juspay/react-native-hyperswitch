/* TypeScript file generated from CardCVCField.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as React from 'react';

import * as CardCVCFieldJS from './CardCVCField.bs.js';

import type {cvcIconDisplay as CardFieldOptions_cvcIconDisplay} from './CardFieldOptions.gen';

import type {cvcOptions as CardFieldOptions_cvcOptions} from './CardFieldOptions.gen';

import type {errorDisplay as CardFieldOptions_errorDisplay} from './CardFieldOptions.gen';

import type {fieldChange as VaultPublicState_fieldChange} from './VaultPublicState.gen';

import type {fieldEvent as VaultPublicState_fieldEvent} from './VaultPublicState.gen';

import type {fieldStyles as CardFieldStyles_fieldStyles} from './CardFieldStyles.gen';

import type {labelBehavior as CardFieldOptions_labelBehavior} from './CardFieldOptions.gen';

export type Props = {
  readonly accessibilityHint?: string; 
  readonly accessibilityLabel?: string; 
  readonly cvcIcon?: CardFieldOptions_cvcIconDisplay; 
  readonly errorDisplay?: CardFieldOptions_errorDisplay; 
  readonly label?: string; 
  readonly labelBehavior?: CardFieldOptions_labelBehavior; 
  readonly onBlur?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly onChange?: (_1:VaultPublicState_fieldChange) => void; 
  readonly onFocus?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly onReady?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly options?: CardFieldOptions_cvcOptions; 
  readonly placeholder?: string; 
  readonly styles?: CardFieldStyles_fieldStyles; 
  readonly testID?: string; 
  readonly unstyled?: boolean
};

export const make: React.ComponentType<{
  readonly accessibilityHint?: string; 
  readonly accessibilityLabel?: string; 
  readonly cvcIcon?: CardFieldOptions_cvcIconDisplay; 
  readonly errorDisplay?: CardFieldOptions_errorDisplay; 
  readonly label?: string; 
  readonly labelBehavior?: CardFieldOptions_labelBehavior; 
  readonly onBlur?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly onChange?: (_1:VaultPublicState_fieldChange) => void; 
  readonly onFocus?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly onReady?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly options?: CardFieldOptions_cvcOptions; 
  readonly placeholder?: string; 
  readonly styles?: CardFieldStyles_fieldStyles; 
  readonly testID?: string; 
  readonly unstyled?: boolean
}> = CardCVCFieldJS.make as any;
