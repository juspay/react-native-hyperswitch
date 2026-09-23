import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the HyperHeadless TurboModule.
 *
 * Naming convention: Native<ModuleName>.ts — required by the RN codegen.
 * number → Double on Android; Object → ReadableMap; Array<Object> → ReadableArray.
 */

/** Exit result object sent by the shared JS bundle (post #569 contract). */
export type PaymentExitResult = {
  status: string;
  type?: string;
  code?: string;
  message?: string;
};

export interface Spec extends TurboModule {
  getPaymentSession(
    rootTag: number,
    defaultPaymentMethod: Object,
    lastUsedPaymentMethod: Object,
    allPaymentMethods: Array<Object>,
    callback: (result: Object) => void
  ): void;

  getWalletSession(
    rootTag: number,
    wallets: Array<Object>,
    callback: (result: Object) => void
  ): void;

  exitHeadless(rootTag: number, status: PaymentExitResult): void;
}

export default TurboModuleRegistry.get<Spec>('HyperHeadless');
