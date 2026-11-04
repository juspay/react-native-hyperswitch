import { createContext } from 'react';
import type { ProviderAdapter } from './ProviderAdapter';
import type { FormLog } from '../logging/formLog';
import type { MountedField } from './savedCard';
import type {
  Appearance,
  ElementType,
  FieldChange,
  FieldOptions,
  FormStatus,
  TokenizeResult,
  VaultType,
} from './types';

export interface FormContextValue {
  vaultType: VaultType | undefined;
  adapter: ProviderAdapter | null;
  collector: unknown | undefined;
  status: FormStatus;

  appearances: readonly Appearance[];
  unstyled?: boolean;
  tokenize: (providerData?: unknown) => Promise<TokenizeResult>;

  reportChange: (change: FieldChange) => void;

  registerField: (elementType: ElementType, options?: FieldOptions) => void;

  forgetField: (elementType: ElementType) => void;

  /* The form's logs; absent outside a session. */
  log?: FormLog;
}

export type { MountedField };

export const FormContext = createContext<FormContextValue | null>(null);
