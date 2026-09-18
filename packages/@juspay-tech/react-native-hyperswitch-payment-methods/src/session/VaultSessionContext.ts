import { createContext } from 'react';

/**
 * The payment-method-session response looked up from `sdkAuthorization`,
 * reshaped for the Hyperswitch vault (`vault_details` carries the
 * authorization, `expires_at` is kept). Internal: the hyperswitch adapter
 * reads it so the vault can refuse an expired session before any request.
 */
export type VaultSession = Record<string, unknown>;

export const VaultSessionContext = createContext<VaultSession | null>(null);
