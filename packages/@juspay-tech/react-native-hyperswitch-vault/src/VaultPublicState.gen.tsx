/* TypeScript file generated from VaultPublicState.res by genType. */

/* eslint-disable */
/* tslint:disable */

export type elementType = 
    "cardNumber"
  | "cardExpiry"
  | "cardCvc"
  | "cardholderName";

export type cardBrand = 
    "Visa"
  | "Mastercard"
  | "AmericanExpress"
  | "DinersClub"
  | "Discover"
  | "JCB"
  | "CartesBancaires"
  | "Interac"
  | "Maestro"
  | "UnionPay"
  | "RuPay"
  | "SODEXO"
  | "BAJAJ";

export type vaultFieldErrorCode = 
    "required"
  | "invalid_card_number"
  | "invalid_expiry"
  | "invalid_cvc"
  | "unsupported_network";

export type vaultFieldError = { readonly code: vaultFieldErrorCode; readonly message: string };

export type vaultEligibilityStatus = "unknown" | "pending" | "allowed" | "denied";

export type fieldEvent = { readonly elementType: elementType };

export type fieldChange = {
  readonly elementType: elementType; 
  readonly empty: boolean; 
  readonly complete: boolean; 
  readonly valid: boolean; 
  readonly brand?: cardBrand; 
  readonly error?: string; 
  readonly errorCode?: vaultFieldErrorCode; 
  readonly touched: boolean; 
  readonly isCoBadged?: boolean; 
  readonly eligibility?: vaultEligibilityStatus
};

export type vaultSessionStatus = 
    "valid"
  | "invalid"
  | "absent"
  | "expired"
  | "consumed";

export type vaultFormFields = {
  readonly cardNumber: fieldChange; 
  readonly cardExpiry: fieldChange; 
  readonly cardCvc: fieldChange; 
  readonly cardholderName?: fieldChange
};

export type cardDetails = {
  readonly bin: (null | undefined | string); 
  readonly extendedBin: (null | undefined | string); 
  readonly last4: (null | undefined | string); 
  readonly brand: (null | undefined | string); 
  readonly expiryMonth: (null | undefined | string); 
  readonly expiryYear: (null | undefined | string); 
  readonly formattedExpiry: (null | undefined | string); 
  readonly isCardNumberComplete: boolean; 
  readonly isCvcComplete: boolean; 
  readonly isExpiryComplete: boolean; 
  readonly isCardNumberValid: boolean; 
  readonly isExpiryValid: boolean
};

export type cardFormEvent = { readonly elementType: "cardForm" };

export type cardFormChange = {
  readonly elementType: 
    "cardForm"; 
  readonly eventName: 
    "cardDetailsChange"; 
  readonly payload: cardDetails; 
  readonly fieldsReady: boolean; 
  readonly sessionStatus: vaultSessionStatus; 
  readonly complete: boolean; 
  readonly valid: boolean; 
  readonly submitting: boolean; 
  readonly canSubmit: boolean; 
  readonly isCoBadged: boolean; 
  readonly eligibility: vaultEligibilityStatus; 
  readonly networkError?: vaultFieldError; 
  readonly fields: vaultFormFields
};
