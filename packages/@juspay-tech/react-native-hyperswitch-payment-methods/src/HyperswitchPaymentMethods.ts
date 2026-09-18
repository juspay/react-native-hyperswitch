import { getFormRegistration, getFormTokenize } from './core/formRegistry';
import { errorResult, paymentError } from './core/results';
import type {
  CardPaymentConfirmInput,
  CardPaymentResult,
  FormId,
  TokenizeResult,
} from './core/types';

export const HyperswitchPaymentMethods = {
  async tokenize(id: FormId, providerData?: unknown): Promise<TokenizeResult> {
    const tokenize = getFormTokenize(id);
    if (!tokenize) {
      return errorResult(
        undefined,
        'incomplete_field_set',
        `No <CardForm id="${id}"> is currently mounted. Pass that id to a form, or call tokenize() on the form ref instead.`
      );
    }
    return tokenize(providerData);
  },

  /**
   * Confirms the payment with the card currently held by `<CardForm id>`.
   * The form's provider owns the card representation and the transport; the
   * caller supplies only non-card context and the payment-intent credential.
   * Returns the complete backend body under `backend_response`, or a typed
   * local outcome when no backend body was produced.
   */
  async confirmCardPayment(
    id: FormId,
    input: CardPaymentConfirmInput
  ): Promise<CardPaymentResult> {
    const registration = getFormRegistration(id);
    if (!registration) {
      return paymentError(
        'not_ready',
        'form_not_mounted',
        `No <CardForm id="${id}"> is currently mounted. Pass that id to a form, or call confirmPayment() on the form ref instead.`
      );
    }
    if (!registration.confirmPayment) {
      return paymentError(
        'not_ready',
        'unsupported_configuration',
        `<CardForm id="${id}"> was registered without payment confirmation support.`
      );
    }
    return registration.confirmPayment(input);
  },
};
