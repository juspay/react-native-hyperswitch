import type {
  CardBrandIconMode,
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

  options?: FieldOptions;

  styles?: FieldStyles;
  placeholder?: string;
  testID?: string;

  /**
   * The host draws the box, border and label itself; the provider renders only
   * the bare input plus the accessories it owns (brand icon / chooser / scan /
   * CVC icon, per `cardBrandIcon` and `cvcIcon`). Providers without the notion
   * ignore it.
   */
  unstyled?: boolean;

  onReady?: (event: FieldEvent) => void;
  onFocus?: (event: FieldEvent) => void;
  onBlur?: (event: FieldEvent) => void;

  onChange?: (change: FieldChange) => void;
}

export interface CardNumberFieldProps extends FieldProps {
  /** Which brand accessory the provider draws on the number field. */
  cardBrandIcon?: CardBrandIconMode;
}

export interface CardCVCFieldProps extends FieldProps {
  cvcIcon?: CvcIconDisplay;
}
