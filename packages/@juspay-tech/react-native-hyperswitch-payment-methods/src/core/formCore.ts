import { createFormSession } from './formSession';
import type { FormSession } from './formSession';
import { mountedField, savedCardOf, withSavedCard } from './savedCard';
import type { MountedFields } from './savedCard';
import { checkConfiguration } from './savedCard';
import { tokenizedCardOf } from './results';
import type { ProviderAdapter } from './ProviderAdapter';
import type { Telemetry } from '../telemetry/telemetry';
import type {
  Appearance,
  CardDetails,
  ElementType,
  FieldChange,
  FieldOptions,
  FormStatus,
  TokenizeResult,
  VaultType,
} from './types';

export interface FormCore {
  readonly vaultType: VaultType;
  readonly adapter: ProviderAdapter;
  readonly appearances: readonly Appearance[];
  readonly unstyled?: boolean;
  collector: unknown | undefined;
  status: FormStatus;
  readonly session: FormSession;
  readonly fields: Partial<Record<ElementType, FieldChange>>;
  readonly mounted: MountedFields;
  details: Partial<CardDetails>;
  readonly telemetry: Telemetry | null;
  subscribe(listener: () => void): () => void;
  notify(): void;
  registerField(elementType: ElementType, options?: FieldOptions): void;
  forgetField(elementType: ElementType): void;
  reportChange(change: FieldChange): void;
  tokenize(providerData?: unknown): Promise<TokenizeResult>;
}

export function createFormCore(
  adapter: ProviderAdapter,
  appearances: readonly Appearance[],
  readyTimeoutMs?: number,
  telemetry: Telemetry | null = null
): FormCore {
  const listeners = new Set<() => void>();
  const session = createFormSession(adapter, {
    ...(readyTimeoutMs !== undefined ? { readyTimeoutMs } : {}),
    ...(telemetry ? { adapterTelemetry: telemetry.adapter } : {}),
  });

  const core: FormCore = {
    vaultType: adapter.vaultType,
    adapter,
    appearances,
    collector: undefined,
    status: 'initializing',
    session,
    fields: {},
    mounted: {},
    details: {},
    telemetry,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      listeners.forEach((listener) => listener());
    },
    registerField(elementType, options) {
      core.mounted[elementType] = mountedField(elementType, options);
    },
    forgetField(elementType) {
      delete core.fields[elementType];
      delete core.mounted[elementType];
    },
    reportChange(change) {
      core.fields[change.elementType] = change;
      telemetry?.dataFilled(
        Object.keys(core.mounted) as ElementType[],
        (field) => core.fields[field]?.complete === true
      );
    },

    async tokenize(providerData?: unknown) {
      telemetry?.tokenizeInitiated(core.vaultType);
      const result = await runTokenize(providerData);
      telemetry?.tokenizeOutcome(result, core.vaultType);
      return result;
    },
  };

  async function runTokenize(providerData?: unknown): Promise<TokenizeResult> {
    const problem = checkConfiguration(core.vaultType, core.mounted);
    if (problem) return problem;

    const result = await session.tokenize(providerData);
    core.status = session.status;
    core.notify();
    if (result.status !== 'success') return result;

    const card = tokenizedCardOf(core.details);
    return withSavedCard(
      card ? { ...result, card } : result,
      savedCardOf(core.mounted)
    );
  }

  return core;
}
