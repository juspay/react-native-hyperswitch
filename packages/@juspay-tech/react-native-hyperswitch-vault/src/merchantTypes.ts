export type MerchantSession = {
  vault_details?: {
    vault_type?: string;
    vault_data?: { sdk_authorization?: string };
  };
  [key: string]: unknown;
};

/**
 * Host-surface only. The complete parsed JSON body of a `/payments/{id}/confirm`
 * response, 2xx or non-2xx. The vault library never interprets it beyond its own
 * sanitized status; the host runs its own decoder over it.
 */
export type HostBackendResponse = unknown;
