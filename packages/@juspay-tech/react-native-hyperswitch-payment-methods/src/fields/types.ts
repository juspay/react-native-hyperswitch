import type {
  CardFormInstance,
  CvcIconDisplay,
  FieldChange,
  FieldEvent,
  FieldOptions,
  FieldStyles,
} from '../core/types';

export type { FieldStyles };

export interface FieldProps {
  form?: CardFormInstance;

  /** The web SDK's field options: `placeholder`, `cvcIcon`, `cardBrandIcon`, `savedCard`. */
  options?: FieldOptions;

  styles?: FieldStyles;
  /** Alias of `options.placeholder`; wins when both are given. */
  placeholder?: string;
  testID?: string;

  onReady?: (event: FieldEvent) => void;
  onFocus?: (event: FieldEvent) => void;
  onBlur?: (event: FieldEvent) => void;

  onChange?: (change: FieldChange) => void;
}

export interface CardCVCFieldProps extends FieldProps {
  /** Alias of `options.cvcIcon`; wins when both are given. */
  cvcIcon?: CvcIconDisplay;
}
