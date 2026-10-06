/*
 * The `logSink` a host SDK passes to <CardForm>. Host-only: the merchant surface (public.ts) omits
 * it. When set, the vault forwards its PAYMENT_METHOD_SESSION_CONFIRM_CALL / _UPDATE_CALL request
 * and response events here instead of logging on its own, and logs nothing else.
 *
 * Events carry the URL, the status code and, for a non-2xx response, the backend error's
 * type / code / message. Never card data, the sdkAuthorization or a token.
 */
export type VaultLogEvent = {
  readonly eventName: string;
  readonly apiLogType: 'Request' | 'Response' | 'NoResponse' | 'Err';
  readonly url: string;
  readonly statusCode: string;
  readonly data?: unknown;
  readonly latency?: number;
};

export type VaultLogSink = (event: VaultLogEvent) => void;
