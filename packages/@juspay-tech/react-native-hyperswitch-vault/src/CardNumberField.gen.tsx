/* TypeScript file generated from CardNumberField.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as React from 'react';

import * as CardNumberFieldJS from './CardNumberField.bs.js';

import type {brandIconMode as CardFieldOptions_brandIconMode} from './CardFieldOptions.gen';

import type {contextValue as VaultWidgetContext_contextValue} from './VaultWidgetContext.gen';

import type {errorDisplay as CardFieldOptions_errorDisplay} from './CardFieldOptions.gen';

import type {fieldChange as VaultPublicState_fieldChange} from './VaultPublicState.gen';

import type {fieldEvent as VaultPublicState_fieldEvent} from './VaultPublicState.gen';

import type {fieldStyles as CardFieldStyles_fieldStyles} from './CardFieldStyles.gen';

import type {labelBehavior as CardFieldOptions_labelBehavior} from './CardFieldOptions.gen';

export type Props = {
  readonly accessibilityHint?: string; 
  readonly accessibilityLabel?: string; 
  readonly cardBrandIcon?: CardFieldOptions_brandIconMode; 
  readonly errorDisplay?: CardFieldOptions_errorDisplay; 
  readonly form?: VaultWidgetContext_contextValue; 
  readonly label?: string; 
  readonly labelBehavior?: CardFieldOptions_labelBehavior; 
  readonly onBlur?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly onChange?: (_1:VaultPublicState_fieldChange) => void; 
  readonly onFocus?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly onReady?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly placeholder?: string; 
  readonly styles?: CardFieldStyles_fieldStyles; 
  readonly testID?: string; 
  readonly unstyled?: boolean
};

export const make: React.ComponentType<{
  readonly accessibilityHint?: string; 
  readonly accessibilityLabel?: string; 
  readonly cardBrandIcon?: CardFieldOptions_brandIconMode; 
  readonly errorDisplay?: CardFieldOptions_errorDisplay; 
  readonly form?: VaultWidgetContext_contextValue; 
  readonly label?: string; 
  readonly labelBehavior?: CardFieldOptions_labelBehavior; 
  readonly onBlur?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly onChange?: (_1:VaultPublicState_fieldChange) => void; 
  readonly onFocus?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly onReady?: (_1:VaultPublicState_fieldEvent) => void; 
  readonly placeholder?: string; 
  readonly styles?: CardFieldStyles_fieldStyles; 
  readonly testID?: string; 
  readonly unstyled?: boolean
}> = CardNumberFieldJS.make as any;
