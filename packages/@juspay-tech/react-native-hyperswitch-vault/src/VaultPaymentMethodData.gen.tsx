/* TypeScript file generated from VaultPaymentMethodData.res by genType. */

/* eslint-disable */
/* tslint:disable */

export type hostBillingAddress = {
  readonly firstName?: string; 
  readonly lastName?: string; 
  readonly line1?: string; 
  readonly line2?: string; 
  readonly line3?: string; 
  readonly city?: string; 
  readonly state?: string; 
  readonly country?: string; 
  readonly zip?: string
};

export type hostPhone = { readonly number?: string; readonly countryCode?: string };

export type hostBilling = {
  readonly address?: hostBillingAddress; 
  readonly email?: string; 
  readonly phone?: hostPhone
};

export type hostPaymentMethodData = { readonly billing?: hostBilling; readonly nickName?: string };

export type acceptanceType = "online" | "offline";

export type hostOnlineAcceptance = { readonly userAgent?: string };

export type hostCustomerAcceptance = {
  readonly acceptanceType: acceptanceType; 
  readonly acceptedAt: string; 
  readonly online: hostOnlineAcceptance
};
