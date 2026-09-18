import type {
  CardFormInstance,
  CardPaymentConfirmInput,
  CardPaymentResult,
  FormId,
  TokenizeResult,
} from './types';
import type { FormCore } from './formCore';

const cores = new WeakMap<CardFormInstance, FormCore>();

export function attachCore(instance: CardFormInstance, core: FormCore): void {
  cores.set(instance, core);
}

export function coreOf(instance: CardFormInstance): FormCore | undefined {
  return cores.get(instance);
}

export type FormTokenizeFn = (
  providerData?: unknown
) => Promise<TokenizeResult>;

export type FormConfirmFn = (
  input: CardPaymentConfirmInput
) => Promise<CardPaymentResult>;

export interface FormRegistration {
  tokenize: FormTokenizeFn;
  confirmPayment?: FormConfirmFn;
}

const forms = new Map<FormId, FormRegistration>();

export function registerForm(
  id: FormId,
  registration: FormTokenizeFn | FormRegistration
): () => void {
  const entry: FormRegistration =
    typeof registration === 'function'
      ? { tokenize: registration }
      : registration;
  forms.set(id, entry);
  return () => {
    if (forms.get(id) === entry) {
      forms.delete(id);
    }
  };
}

export function getFormRegistration(id: FormId): FormRegistration | undefined {
  return forms.get(id);
}

export function getFormTokenize(id: FormId): FormTokenizeFn | undefined {
  return forms.get(id)?.tokenize;
}
