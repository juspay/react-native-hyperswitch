import { createCardField } from './createCardField';
import type { CardNumberFieldProps } from './types';

export const CardNumberField = createCardField<CardNumberFieldProps>(
  'cardNumber',
  'CardNumberField'
);
