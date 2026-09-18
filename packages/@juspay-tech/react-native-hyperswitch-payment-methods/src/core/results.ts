import type {
  CardDetails,
  CardPaymentErrorStatus,
  CardPaymentResult,
  TokenizeErrorCode,
  TokenizeErrorType,
  TokenizedCard,
  TokenizeResult,
  VaultType,
} from './types';

export function errorTypeFor(code: TokenizeErrorCode): TokenizeErrorType {
  return code === 'validation_error' || code === 'incomplete_field_set'
    ? 'validation_error'
    : 'api_error';
}

export function errorResult(
  vaultType: VaultType | undefined,
  code: TokenizeErrorCode,
  message: string
): TokenizeResult {
  const type = errorTypeFor(code);
  return {
    status: type === 'validation_error' ? 'validation_error' : 'error',
    vaultType,
    error: { code, message, type },
  };
}

export function tokenizedCardOf(
  details: Partial<CardDetails>
): TokenizedCard | undefined {
  const card: TokenizedCard = {};
  if (details.bin) card.bin = details.bin;
  if (details.last4) card.last4 = details.last4;
  if (details.brand) card.brand = details.brand;
  if (details.expiryMonth) card.expiryMonth = details.expiryMonth;
  if (details.expiryYear) card.expiryYear = details.expiryYear;
  return Object.keys(card).length > 0 ? card : undefined;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function paymentError(
  status: CardPaymentErrorStatus,
  code: string,
  message: string,
  type: string = status === 'validation_error'
    ? 'validation_error'
    : 'api_error'
): CardPaymentResult {
  return { status, error: { code, message, type } };
}

/**
 * Maps a local tokenize refusal (configuration / readiness) onto the confirm
 * result union so both entry points refuse the same situations the same way.
 */
export function paymentErrorOfTokenizeProblem(
  problem: TokenizeResult
): CardPaymentResult {
  if (problem.status === 'success') {
    return paymentError(
      'unknown_outcome',
      'unknown_outcome',
      'Unexpected success.'
    );
  }
  const { code, message, type } = problem.error;
  const status: CardPaymentErrorStatus =
    code === 'sdk_not_ready' || code === 'unsupported_configuration'
      ? 'not_ready'
      : type === 'validation_error'
        ? 'validation_error'
        : 'tokenization_error';
  return paymentError(status, code, message, type);
}
