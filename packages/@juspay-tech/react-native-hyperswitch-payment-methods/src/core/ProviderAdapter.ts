import type { ComponentType, ReactNode, Ref } from 'react';
import type {
  CardBrandIconDisplay,
  CardDetails,
  CvcIconDisplay,
  ElementType,
  FieldAppearance,
  FieldChange,
  FieldEvent,
  FieldHandle,
  FieldStyles,
  SavedCard,
  TokenizeResult,
  VaultType,
} from './types';

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
  testID?: string;

  savedCard?: SavedCard;

  cvcIcon?: CvcIconDisplay;

  cardBrandIcon?: CardBrandIconDisplay;

  appearance?: FieldAppearance;
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

  tokenize(
    collector: Collector,
    providerData?: unknown
  ): Promise<TokenizeResult>;
}
