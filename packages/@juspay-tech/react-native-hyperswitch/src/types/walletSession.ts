import type { PaymentResult } from './paymentresult';

export type WalletName = 'google_pay' | 'apple_pay';

export type WalletSessionHandle = {
  isWalletEligible(wallet: WalletName): Promise<boolean>;
  isGooglePayEligible(): Promise<boolean>;
  isApplePayEligible(): Promise<boolean>;
  launchWallet(wallet: WalletName): Promise<PaymentResult>;
  launchGooglePay(): Promise<PaymentResult>;
  launchApplePay(): Promise<PaymentResult>;
};
