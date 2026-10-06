import type { ComponentType, ReactNode, Ref } from 'react';
import type {
  CardBrandIconDisplay,
  CardDetails,
  CvcIconDisplay,
  ElementType,
  ErrorDisplay,
  FieldChange,
  FieldEvent,
  LabelBehavior,
  FieldHandle,
  FieldStyles,
  SavedCard,
  TokenizeResult,
  VaultType,
} from './types';
import type { AdapterTelemetry } from '../telemetry/telemetry';

export interface ProviderHostProps<Collector = unknown, Data = unknown> {
  vaultData: Data;
  onReady: (collector: Collector) => void;
  onError: (error: unknown) => void;

  onCardDetails?: (details: Partial<CardDetails>) => void;
  children: ReactNode;
}

export interface ProviderFieldProps<Collector = unknown> {
  elementType: ElementType;
  collector: Collector;
  styles?: FieldStyles;
  placeholder?: string;
  label?: string;
  labelBehavior?: LabelBehavior;
  errorDisplay?: ErrorDisplay;
  unstyled?: boolean;

  savedCard?: SavedCard;

  cvcIcon?: CvcIconDisplay;

  cardBrandIcon?: CardBrandIconDisplay;
  onChange?: (change: FieldChange) => void;
  onFocus?: (event: FieldEvent) => void;
  onBlur?: (event: FieldEvent) => void;

  fieldRef?: Ref<FieldHandle>;
}

export interface ProviderAdapter<Collector = unknown, Data = unknown> {
  readonly vaultType: VaultType;

  validateVaultData(raw: unknown): Data;

  createCollector?(vaultData: Data): Promise<Collector>;

  Host: ComponentType<ProviderHostProps<Collector, Data>>;

  Field: ComponentType<ProviderFieldProps<Collector>>;

  /* `telemetry` reports provider-level outcomes (VGS_VAULT_FLOW). Status codes only, never the
     provider's response body. */
  tokenize(
    collector: Collector,
    providerData?: unknown,
    telemetry?: AdapterTelemetry
  ): Promise<TokenizeResult>;
}
