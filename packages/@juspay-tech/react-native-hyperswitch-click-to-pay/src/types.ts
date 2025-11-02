export type ClickToPayConfig = {
  dpaId: string;
  environment: 'sandbox' | 'production';
  provider: 'visa' | 'mastercard';
  locale?: string;
  cardBrands?: string;
  clientId?: string;
  transactionAmount?: string | number;
  transactionCurrency?: string;
  timeout?: number;
  debug?: boolean;
  recognitionToken?: string;
};

export type ClickToPayCard = {
  id: string;
  maskedPan: string;
  brand: 'visa' | 'mastercard';
  expiryMonth: string;
  expiryYear: string;
  digitalCardId: string;
};

export type PaymentRequest = {
  amount: number;
  currency: string;
  merchantId: string;
  transactionId: string;
};

export type PaymentResult = {
  success: boolean;
  transactionId: string;
  paymentToken?: string;
  error?: string;
};

export type ClickToPayError = {
  message: string;
  code: string;
  category: 'configuration' | 'network' | 'payment' | 'user';
  recoverable: boolean;
  details?: any;
};
