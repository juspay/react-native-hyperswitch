import type { ComponentType, ReactNode, Ref } from 'react';
import type {
  CardDetails,
  ElementType,
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
  onChange?: (change: FieldChange) => void;
  onFocus?: (event: FieldEvent) => void;
  onBlur?: (event: FieldEvent) => void;

  fieldRef?: Ref<FieldHandle>;

  /*
   * Lets a field push a replacement collector once one resolves asynchronously post-mount, for
   * adapters whose collector can only be built inside a mounted component (Hyperswitch's own
   * vault SDK, whose fields coordinate through a React context rather than a plain client
   * object). Adapters that resolve their collector up front via `createCollector` ignore it.
   */
  onCollectorReady?: (next: Collector) => void;
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
