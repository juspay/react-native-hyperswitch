import type {
  CardFormInstance,
  FieldChange,
  FieldEvent,
  FieldOptions,
  FieldStyles,
} from '../core/types';

export type { FieldStyles };

export interface FieldProps {
  form?: CardFormInstance;

  options?: FieldOptions;

  styles?: FieldStyles;
  placeholder?: string;
  testID?: string;

  onReady?: (event: FieldEvent) => void;
  onFocus?: (event: FieldEvent) => void;
  onBlur?: (event: FieldEvent) => void;

  onChange?: (change: FieldChange) => void;
}
