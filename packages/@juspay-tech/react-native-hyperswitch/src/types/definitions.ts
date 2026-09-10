import type { PaymentResult } from './paymentresult';
import type { WalletSessionHandle } from './walletSession';
export interface OverrideEndpointConfiguration {
  customBackendEndpoint?: string;
  customLoggingEndpoint?: string;
  customAssetEndpoint?: string;
  customSDKConfigEndpoint?: string;
  customAirborneEndpoint?: string;
}

export interface CommonEndpoint {
  commonEndpoint: string;
}

export interface OverrideEndpoints {
  overrideEndpoints: OverrideEndpointConfiguration;
}

export type HyperswitchEnvironment = 'PROD' | 'SANDBOX' | 'INTEG';

/**
 * @deprecated Not used by the SDK anymore. Kept for source compatibility;
 *             will be removed in a future major release.
 */
export type ElementType = 'paymentElement' | 'cvcWidget';

export interface HyperswitchConfiguration {
  publishableKey: string;
  platformPublishableKey?: string;
  profileId?: string;
  environment?: HyperswitchEnvironment;
  customEndpoints?: CommonEndpoint | OverrideEndpoints;
}

export interface PaymentSessionConfiguration {
  sdkAuthorization: string;
}

/**
 * Full payload sent to the native SDK. It is assembled internally from the
 * merchant-supplied configuration plus the SDK/payment-session metadata.
 */
export interface NativePaymentSheetPayload {
  hyperswitchConfig: Record<string, unknown>;
  paymentSessionConfig: { sdkAuthorization: string };
  configuration: Record<string, unknown>;
}

import {
  CustomerSavedPaymentMethodsSession,
  SavedPaymentMethodsConfiguration,
} from './savedPaymentMethods';
import type { Elements } from './elements';
import type {
  ColorType,
  Shapes,
  Theme,
  Font,
  SubscriptionEvent,
  PaymentSheetConfiguration,
} from './PaymentSheetConfiguration';

export interface PaymentSession {
  presentPaymentSheet(
    configuration?: PaymentSheetConfiguration
  ): Promise<PaymentResult>;
  getCustomerSavedPaymentMethods(
    options?: SavedPaymentMethodsConfiguration
  ): Promise<CustomerSavedPaymentMethodsSession>;
  getWalletSession(): Promise<WalletSessionHandle>;
  updateIntent(
    intentResolver: () => Promise<PaymentSessionConfiguration | null>
  ): Promise<void>;
}

export interface PaymentElementHandle {
  confirmPayment(options?: {
    confirmParams?: Record<string, any>;
  }): Promise<PaymentResult>;
}

export interface GooglePayElementHandle {}

export interface ApplePayElementHandle {}

export interface HyperswitchSession {
  publishableKey: string;
  elements(options: PaymentSessionConfiguration): Promise<Elements>;
  initPaymentSession(
    options: PaymentSessionConfiguration
  ): Promise<PaymentSession>;
}

export interface CvcAppearance {
  theme?: Theme;
  colors?: ColorType;
  shapes?: Shapes;
  font?: Pick<Font, 'family' | 'scale'>;
}

export interface CvcWidgetOptions {
  appearance?: CvcAppearance;
  placeholder?: string;
  cvcIcon?: 'hidden' | 'shown';
  subscribedEvents?: SubscriptionEvent[];
}
