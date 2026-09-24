import type { PaymentResult } from '../types/paymentresult';

interface NativeResponse {
  status: string;
  message?: string;
  // Android's PaymentResult.Failed historically wrote the text under `error`.
  error?: string;
  code?: string;
  type?: string;
  data?: any;
}

export function parseNativeResponse(
  raw: string | NativeResponse
): NativeResponse {
  if (typeof raw === 'object' && raw !== null) {
    return raw as NativeResponse;
  }
  try {
    return JSON.parse(raw as string) as NativeResponse;
  } catch {
    return { status: 'failed', message: String(raw) };
  }
}

export function mapStatus(status: string): PaymentResult['status'] {
  switch (status) {
    case 'succeeded':
    case 'completed':
    case 'requires_capture':
    case 'success':
      return 'completed';
    case 'cancelled':
    case 'canceled':
      return 'canceled';
    case 'failed':
    case 'error':
    default:
      return 'failed';
  }
}

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

export function mapNativeResponseToPaymentResult(
  raw: string | NativeResponse
): PaymentResult {
  const parsed = parseNativeResponse(raw);
  const status = mapStatus(parsed.status);
  const detail = firstNonEmpty(parsed.message, parsed.error, parsed.code);
  return {
    status,
    type: firstNonEmpty(parsed.type, parsed.code, status) ?? '',
    // Never hand back an empty message for a failure; callers show it to users.
    message:
      detail ??
      (status === 'failed'
        ? 'The payment failed but no error detail was returned.'
        : ''),
  };
}
