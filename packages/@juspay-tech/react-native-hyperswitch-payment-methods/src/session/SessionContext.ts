import { createContext } from 'react';
import type { Appearance, VaultDetails } from '../core/types';
import type { HyperswitchConfiguration } from './config';

export interface PaymentMethodsSession {
  hyper: HyperswitchConfiguration | null;
  sdkAuthorization: string | null;

  vaultDetails: VaultDetails | null;
  appearance: Appearance | null;
  locale: string | null;
  // DEFERRED (follow-up PR): the looked-up session's `expires_at`, carried
  // here (not in a separate context) for the hyperswitch adapter.
  // expiresAt: string | null;

  loading: boolean;
  error: Error | null;
}

export const SessionContext = createContext<PaymentMethodsSession | null>(null);
