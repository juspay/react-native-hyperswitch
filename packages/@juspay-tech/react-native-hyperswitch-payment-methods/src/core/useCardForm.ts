import { useContext } from 'react';
import { FormContext } from './FormContext';
import type {
  CardPaymentConfirmInput,
  CardPaymentResult,
  FormStatus,
  TokenizeResult,
  VaultType,
} from './types';

export interface UseCardForm {
  tokenize: (providerData?: unknown) => Promise<TokenizeResult>;
  confirmPayment: (
    input: CardPaymentConfirmInput
  ) => Promise<CardPaymentResult>;
  status: FormStatus;

  vaultType: VaultType | undefined;
}

export function useCardForm(): UseCardForm {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error('useCardForm must be used inside a <CardForm>.');
  }
  return {
    tokenize: ctx.tokenize,
    confirmPayment: ctx.confirmPayment,
    status: ctx.status,
    vaultType: ctx.vaultType,
  };
}
