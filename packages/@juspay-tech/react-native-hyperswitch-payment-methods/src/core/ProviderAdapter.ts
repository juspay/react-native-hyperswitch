import type { ComponentType, ReactNode, Ref } from 'react';
import type {
  CardBrandIconMode,
  CardDetails,
  CardPaymentConfirmInput,
  CardPaymentResult,
  CvcIconDisplay,
  ElementType,
  FieldChange,
  FieldEvent,
  FieldHandle,
  FieldStyles,
  SavedCard,
  TokenizeResult,
  VaultType,
} from './types';

export interface ProviderHostProps<
  Collector = unknown,
  Data = unknown,
  DirectData = unknown,
> {
  /** The validated vault data (tokenized mode). `undefined` in direct mode. */
  vaultData: Data;
  /**
   * The validated direct-card configuration. Present ONLY when the form was
   * explicitly mounted in direct mode (`CardForm`'s `directCard` prop) on an
   * adapter that implements `validateDirectData`; the core never sets it
   * because vault data was missing or invalid.
   */
  direct?: DirectData;
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
  unstyled?: boolean;
  cardBrandIcon?: CardBrandIconMode;
  cvcIcon?: CvcIconDisplay;

  savedCard?: SavedCard;

  onChange?: (change: FieldChange) => void;
  onFocus?: (event: FieldEvent) => void;
  onBlur?: (event: FieldEvent) => void;

  fieldRef?: Ref<FieldHandle>;
}

export interface ProviderAdapter<
  Collector = unknown,
  Data = unknown,
  DirectData = unknown,
> {
  readonly vaultType: VaultType;

  validateVaultData(raw: unknown): Data;

  /**
   * Explicit direct-card mode: the provider renders its own secure fields
   * WITHOUT a vault session and confirms the payment itself from the raw card
   * it holds. Only providers whose fields can POST `/payments/{id}/confirm`
   * implement this; the core refuses direct mode on any other adapter.
   */
  validateDirectData?(raw: unknown): DirectData;

  createCollector?(vaultData: Data): Promise<Collector>;

  Host: ComponentType<ProviderHostProps<Collector, Data, DirectData>>;

  Field: ComponentType<ProviderFieldProps<Collector>>;

  tokenize(
    collector: Collector,
    providerData?: unknown
  ): Promise<TokenizeResult>;

  /**
   * Library-owned payment confirmation. The adapter selects the card source
   * from its own collector/session state, merges the host's non-card context,
   * performs `POST /payments/{id}/confirm` and returns the complete backend
   * body. Providers without this method cannot confirm through the library.
   */
  confirmPayment?(
    collector: Collector,
    input: CardPaymentConfirmInput
  ): Promise<CardPaymentResult>;
}
