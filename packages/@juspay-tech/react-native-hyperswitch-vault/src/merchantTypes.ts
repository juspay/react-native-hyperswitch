export type MerchantSession = {
  vault_details?: {
    vault_type?: string;
    vault_data?: { sdk_authorization?: string };
  };
  [key: string]: unknown;
};
