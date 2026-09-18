/* TypeScript file generated from VaultConfirmBody.res by genType. */

/* eslint-disable */
/* tslint:disable */

export type paymentMethodType = "credit" | "debit";

export type paymentType = 
    "normal"
  | "new_mandate"
  | "setup_mandate"
  | "recurring_mandate";

export type acceptanceType = "online" | "offline";

export type confirmTokenMode = "payment_token" | "vault_card";

export type hostBrowserInfo = {
  readonly userAgent?: string; 
  readonly acceptHeader?: string; 
  readonly language?: string; 
  readonly colorDepth?: number; 
  readonly screenHeight?: number; 
  readonly screenWidth?: number; 
  readonly timeZone?: number; 
  readonly javaEnabled?: boolean; 
  readonly javaScriptEnabled?: boolean; 
  readonly deviceModel?: string; 
  readonly osType?: string; 
  readonly osVersion?: string
};

export type hostOnlineAcceptance = { readonly userAgent?: string };

export type hostCustomerAcceptance = {
  readonly acceptanceType: acceptanceType; 
  readonly acceptedAt: string; 
  readonly online: hostOnlineAcceptance
};

export type providerTokenizedCard = {
  readonly cardNumberAlias: string; 
  readonly cardCvcAlias: string; 
  readonly expiryMonth: string; 
  readonly expiryYear: string; 
  readonly cardHolderName?: string; 
  readonly cardNetwork?: string; 
  readonly lastFour?: string; 
  readonly binNumber?: string; 
  readonly nickName?: string
};
