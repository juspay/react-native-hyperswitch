import { createContext } from 'react';

/**
 * The `expires_at` of the payment-method session looked up from
 * `sdkAuthorization`, with the authorization it belongs to. Internal: the
 * hyperswitch adapter passes it to the vault so an expired session is refused
 * before any confirm request. Absent when the lookup carried no expiry.
 */
export interface VaultSessionExpiry {
  sdkAuthorization: string;
  expiresAt: string;
}

export const VaultSessionContext = createContext<VaultSessionExpiry | null>(
  null
);
