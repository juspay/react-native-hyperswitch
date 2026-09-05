/* TypeScript file generated from CardFieldOptions.res by genType. */

/* eslint-disable */
/* tslint:disable */

import type {brandIconMode as CardIcons_brandIconMode} from './CardIcons.gen';

export type labelBehavior = "above" | "floating" | "never";

export type errorDisplay = "none" | "colorOnly" | "inline";

export type brandIconMode = CardIcons_brandIconMode;

export type cvcIconDisplay = "hidden" | "default";

export type fieldOptions = {
  readonly placeholder?: string; 
  readonly label?: string; 
  readonly labelBehavior?: labelBehavior; 
  readonly errorDisplay?: errorDisplay; 
  readonly accessibilityLabel?: string; 
  readonly accessibilityHint?: string; 
  readonly testID?: string; 
  readonly unstyled?: boolean
};

export type cardNumberOptions = {
  readonly placeholder?: string; 
  readonly label?: string; 
  readonly labelBehavior?: labelBehavior; 
  readonly errorDisplay?: errorDisplay; 
  readonly accessibilityLabel?: string; 
  readonly accessibilityHint?: string; 
  readonly testID?: string; 
  readonly unstyled?: boolean; 
  readonly cardBrandIcon?: brandIconMode
};

export type expiryOptions = fieldOptions;

export type cardholderNameOptions = fieldOptions;

export type savedCardData = { readonly cardNetwork?: string };

export type savedCardPaymentMethodData = { readonly card?: savedCardData };

export type savedCard = { readonly paymentMethodToken?: string; readonly paymentMethodData?: savedCardPaymentMethodData };

export type cvcOptions = {
  readonly placeholder?: string; 
  readonly label?: string; 
  readonly labelBehavior?: labelBehavior; 
  readonly errorDisplay?: errorDisplay; 
  readonly accessibilityLabel?: string; 
  readonly accessibilityHint?: string; 
  readonly testID?: string; 
  readonly unstyled?: boolean; 
  readonly cvcIcon?: cvcIconDisplay; 
  readonly savedCard?: savedCard
};

export type formFieldOptions = {
  readonly cardNumber?: cardNumberOptions; 
  readonly cardExpiry?: expiryOptions; 
  readonly cardCvc?: cvcOptions; 
  readonly cardholderName?: cardholderNameOptions
};

export type cardholderNameMode = "collect" | "external" | "omit";

export type formLayout = "stacked" | "inline";

export type fieldArrangement = "separate" | "fused";
