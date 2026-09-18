/* TypeScript file generated from VaultResult.res by genType. */

/* eslint-disable */
/* tslint:disable */

import type {HostBackendResponse as $$backendResponse} from './merchantTypes';

import type {nextActionType as VaultNavigation_nextActionType} from './VaultNavigation.gen';

import type {safeDdc as VaultNavigation_safeDdc} from './VaultNavigation.gen';

import type {safeNextAction as VaultNavigation_safeNextAction} from './VaultNavigation.gen';

import type {safeSessionToken as VaultNavigation_safeSessionToken} from './VaultNavigation.gen';

import type {safeThreeDs as VaultNavigation_safeThreeDs} from './VaultNavigation.gen';

export type safeVaultErrorCode = 
    "validation_error"
  | "incomplete_field_set"
  | "session_expired"
  | "session_consumed"
  | "tokenization_in_progress"
  | "confirm_in_progress"
  | "tokenization_failed"
  | "invalid_session"
  | "unsupported_configuration"
  | "unknown_outcome"
  | "payment_failed"
  | "forbidden_card_data"
  | "card_not_eligible";

export type safeVaultErrorType = 
    "validation_error"
  | "api_error"
  | "card_error";

export type safeVaultError = {
  readonly code: safeVaultErrorCode; 
  readonly message: string; 
  readonly type: safeVaultErrorType
};

export type nextActionType = VaultNavigation_nextActionType;

export type safeThreeDs = VaultNavigation_safeThreeDs;

export type safeDdc = VaultNavigation_safeDdc;

export type safeSessionToken = VaultNavigation_safeSessionToken;

export type safeNextAction = VaultNavigation_safeNextAction;

export type vaultPaymentStatus = 
    "succeeded"
  | "processing"
  | "requires_customer_action"
  | "failed"
  | "validation_error";

export type vaultTokenizeStatus = "success" | "validation_error" | "error";

export type backendResponse = $$backendResponse;

export type vaultPaymentResult = {
  readonly status: vaultPaymentStatus; 
  readonly error?: safeVaultError; 
  readonly nextAction?: safeNextAction; 
  readonly response?: backendResponse
};

export type vaultTokenizedCard = {
  readonly bin?: string; 
  readonly last4: string; 
  readonly brand?: string; 
  readonly expiryMonth: string; 
  readonly expiryYear: string
};

export type vaultTokenizeResult = {
  readonly status: vaultTokenizeStatus; 
  readonly token?: string; 
  readonly card?: vaultTokenizedCard; 
  readonly error?: safeVaultError
};
