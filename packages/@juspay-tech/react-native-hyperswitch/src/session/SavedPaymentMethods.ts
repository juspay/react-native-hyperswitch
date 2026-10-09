import NativeHyperswitchModule from '../codegen/modules/NativeHyperswitchModule';
import {
  HyperswitchConfiguration,
  PaymentSessionConfiguration,
} from '../types/definitions';
import {
  CustomerSavedPaymentMethodsSession,
  CustomerLastUsedPaymentMethod,
  SavedPaymentMethodsConfiguration,
} from '../types/savedPaymentMethods';
import type { PaymentResult } from '../types/paymentresult';
import { mapNativeResponseToPaymentResult } from '../native/NativeResponseMapper';
import { getWidget } from '../widget/WidgetRegistry';

function getReactTag(widgetId?: string): number {
  if (!widgetId) {
    throw new Error('A widgetId is required to confirm a saved payment method');
  }

  const reactTag = getWidget(widgetId);
  if (reactTag === undefined) {
    throw new Error(`Widget ${widgetId} not found or not mounted`);
  }
  return reactTag;
}

type RawCustomerPaymentMethod = Omit<
  CustomerLastUsedPaymentMethod,
  'billing'
> & {
  billing?: string | CustomerLastUsedPaymentMethod['billing'];
};

function parseBilling(
  raw: RawCustomerPaymentMethod['billing']
): CustomerLastUsedPaymentMethod['billing'] {
  if (raw == null || typeof raw !== 'string') {
    return (raw ?? null) as CustomerLastUsedPaymentMethod['billing'];
  }
  try {
    return JSON.parse(raw) as CustomerLastUsedPaymentMethod['billing'];
  } catch {
    return null;
  }
}

function parsePaymentMethod(raw: string): CustomerLastUsedPaymentMethod | null {
  try {
    const parsed = JSON.parse(raw) as RawCustomerPaymentMethod;
    const result: CustomerLastUsedPaymentMethod = {
      ...parsed,
      billing: parseBilling(parsed.billing),
    };
    return result;
  } catch {
    return null;
  }
}

export function createCustomerSavedPaymentMethodsSession(): CustomerSavedPaymentMethodsSession {
  return {
    async getCustomerLastUsedPaymentMethodData(): Promise<CustomerLastUsedPaymentMethod | null> {
      const raw =
        await NativeHyperswitchModule.getCustomerLastUsedPaymentMethodData();
      return parsePaymentMethod(raw);
    },

    async getCustomerDefaultSavedPaymentMethodData(): Promise<CustomerLastUsedPaymentMethod | null> {
      const raw =
        await NativeHyperswitchModule.getCustomerDefaultSavedPaymentMethodData();
      return parsePaymentMethod(raw);
    },

    async getCustomerSavedPaymentMethodData(): Promise<CustomerLastUsedPaymentMethod | null> {
      const raw =
        await NativeHyperswitchModule.getCustomerSavedPaymentMethodData();
      return parsePaymentMethod(raw);
    },

    async confirmWithCustomerLastUsedPaymentMethod(args?: {
      id?: string;
    }): Promise<PaymentResult> {
      const raw =
        await NativeHyperswitchModule.confirmWithCustomerLastUsedPaymentMethod(
          getReactTag(args?.id)
        );
      return mapNativeResponseToPaymentResult(raw);
    },

    async confirmWithCustomerDefaultPaymentMethod(args?: {
      id?: string;
    }): Promise<PaymentResult> {
      const raw =
        await NativeHyperswitchModule.confirmWithCustomerDefaultPaymentMethod(
          getReactTag(args?.id)
        );
      return mapNativeResponseToPaymentResult(raw);
    },
  };
}

export async function getCustomerSavedPaymentMethods(
  hyperswitchConfig: HyperswitchConfiguration,
  paymentSessionConfig: PaymentSessionConfiguration,
  configuration?: SavedPaymentMethodsConfiguration,
  sessionTag?: number
): Promise<CustomerSavedPaymentMethodsSession> {
  const payload = {
    hyperswitchConfig,
    paymentSessionConfig,
    sessionTag,
    configuration : {
      ...configuration,
      paymentMethodLayout : {
        savedMethodCustomization : {
          hiddenPaymentMethods : configuration?.hiddenPaymentMethods ?? [],
        },
      }
    },
  };
  await NativeHyperswitchModule.getCustomerSavedPaymentMethods(payload);
  return createCustomerSavedPaymentMethodsSession();
}
