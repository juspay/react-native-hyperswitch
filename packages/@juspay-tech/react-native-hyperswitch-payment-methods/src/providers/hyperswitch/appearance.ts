import { StyleSheet } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import type {
  Appearance,
  AppearanceLabels,
  AppearanceVariables,
  FieldAppearance,
  FieldStyles,
} from '../../core/types';
import { APPEARANCE_LABELS, pickAllowed } from '../../core/validate';

/** What the Hyperswitch vault `CardForm` takes as `appearance`. */
export interface VaultAppearance {
  variables?: Record<string, unknown>;
  labels?: 'above' | 'floating' | 'never';
}

/** The vault field's style slots this adapter fills (its public `fieldStyles`). */
export interface VaultFieldStyles {
  container?: StyleProp<ViewStyle>;
  input?: StyleProp<TextStyle>;
  placeholder?: StyleProp<TextStyle>;
  label?: StyleProp<TextStyle>;
}

const PX = /^(-?\d+(?:\.\d+)?)px$/;

/** Web lengths are CSS strings; the vault wants points. `12px` → 12, `1rem` → dropped. */
export function toPoints(
  value: number | string | undefined
): number | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const match = PX.exec(value.trim());
  return match ? Number(match[1]) : undefined;
}

const LABELS: Record<AppearanceLabels, VaultAppearance['labels']> = {
  above: 'above',
  floating: 'floating',
  none: 'never',
};

export function toVaultLabels(
  labels: unknown,
  path: string
): VaultAppearance['labels'] {
  const picked = pickAllowed(labels, APPEARANCE_LABELS, path);
  return picked ? LABELS[picked] : undefined;
}

const COLOR_KEYS = [
  'colorPrimary',
  'colorText',
  'colorDanger',
  'colorTextPlaceholder',
  'colorBackground',
  'borderColor',
  'fontFamily',
] as const;
const LENGTH_KEYS = ['borderRadius', 'inputFieldHeight'] as const;

/** Keeps the web variable names the vault honours, with lengths in points; anything else is dropped. */
function toVaultVariables(
  variables: AppearanceVariables
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of COLOR_KEYS) {
    const value = variables[key];
    if (typeof value === 'string' && value !== '') out[key] = value;
  }
  for (const key of LENGTH_KEYS) {
    const points = toPoints(variables[key]);
    if (points !== undefined) out[key] = points;
  }
  return out;
}

/**
 * Folds the session's and the form's `appearance` layers (later wins, per
 * variable) into the vault's shape. `theme` has no vault counterpart and is
 * not forwarded.
 */
export function toVaultAppearance(
  layers: readonly Appearance[]
): VaultAppearance | undefined {
  let variables: Record<string, unknown> | undefined;
  let labels: VaultAppearance['labels'];
  for (const layer of layers) {
    if (layer.variables && typeof layer.variables === 'object') {
      variables = {
        ...(variables ?? {}),
        ...toVaultVariables(layer.variables),
      };
    }
    const layerLabels = toVaultLabels(layer.labels, 'appearance.labels');
    if (layerLabels) labels = layerLabels;
  }
  if (!variables && !labels) return undefined;
  const out: VaultAppearance = {};
  if (variables) out.variables = variables;
  if (labels) out.labels = labels;
  return out;
}

/**
 * The vault theme's defaults (VaultFormOptions.res buildTheme, vault 1.0.1).
 * A non-empty field appearance replaces the session's on web, so a field that
 * sets some variables must fall back to these, not to the session's values,
 * for the rest. Kept here because the vault does not export them.
 */
const VAULT_THEME_DEFAULTS = {
  colorText: '#1A1A1A',
  colorTextPlaceholder: '#6B7280',
  colorBackground: '#FFFFFF',
  borderColor: '#E6E6E6',
  borderRadius: 8,
  inputFieldHeight: 48,
  fontFamily: 'System',
} as const;

/** Web replaces the session appearance when the field's has any key at all. */
export function replacesSessionAppearance(
  appearance: FieldAppearance | undefined
): boolean {
  return (
    !!appearance &&
    typeof appearance === 'object' &&
    Object.keys(appearance).length > 0
  );
}

/**
 * A field's own `options.appearance.variables`, expressed as that field's
 * style slots. With `replace`, every mappable variable the field leaves unset
 * is pinned to the vault default so the session's value no longer shows
 * through (the web rule). `colorPrimary` (focus ring) and `colorDanger`
 * (error tint) are state-dependent theme colours the slots cannot express;
 * they stay session-level either way.
 */
export function fieldVariablesToStyles(
  variables: AppearanceVariables | undefined,
  replace = false
): VaultFieldStyles {
  const own =
    variables && typeof variables === 'object'
      ? toVaultVariables(variables)
      : {};
  if (!replace && !Object.keys(own).length) return {};
  const v: Record<string, unknown> = replace
    ? { ...VAULT_THEME_DEFAULTS, ...own }
    : own;
  // RN's style types are readonly; build mutable records and cast once.
  const container: Record<string, string | number> = {};
  const input: Record<string, string | number> = {};
  const text: Record<string, string | number> = {};
  if (typeof v.colorBackground === 'string')
    container.backgroundColor = v.colorBackground;
  if (typeof v.borderColor === 'string') container.borderColor = v.borderColor;
  if (typeof v.borderRadius === 'number') {
    // The vault sets each corner; a plain borderRadius would lose to them.
    container.borderTopLeftRadius = v.borderRadius;
    container.borderTopRightRadius = v.borderRadius;
    container.borderBottomLeftRadius = v.borderRadius;
    container.borderBottomRightRadius = v.borderRadius;
  }
  if (typeof v.inputFieldHeight === 'number')
    container.height = v.inputFieldHeight;
  if (typeof v.colorText === 'string') input.color = v.colorText;
  if (typeof v.colorTextPlaceholder === 'string')
    text.color = v.colorTextPlaceholder;
  if (typeof v.fontFamily === 'string') {
    input.fontFamily = v.fontFamily;
    text.fontFamily = v.fontFamily;
  }
  const out: VaultFieldStyles = {};
  if (Object.keys(container).length) out.container = container as ViewStyle;
  if (Object.keys(input).length) out.input = input as TextStyle;
  if (Object.keys(text).length) {
    out.placeholder = text as TextStyle;
    out.label = text as TextStyle;
  }
  return out;
}

/** The field's own `styles` win over its `options.appearance`. */
export function mergeFieldStyles(
  fromAppearance: VaultFieldStyles,
  own: FieldStyles | undefined
): VaultFieldStyles | undefined {
  const out: VaultFieldStyles = { ...fromAppearance };
  if (own?.container) {
    out.container = StyleSheet.flatten([
      fromAppearance.container,
      own.container,
    ]);
  }
  if (own?.input) {
    out.input = StyleSheet.flatten([fromAppearance.input, own.input]);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * A non-empty field appearance replaces the session's for that field, as on
 * web: unset variables revert to the vault defaults and an unset `labels`
 * reverts to the vault's default label mode (`floating`) instead of the
 * session's `labels`.
 */
export function resolveFieldAppearance(
  appearance: FieldAppearance | undefined
): { styles: VaultFieldStyles; labelBehavior?: VaultAppearance['labels'] } {
  if (!replacesSessionAppearance(appearance)) return { styles: {} };
  const labelBehavior =
    toVaultLabels(appearance!.labels, 'options.appearance.labels') ??
    'floating';
  return {
    styles: fieldVariablesToStyles(appearance!.variables, true),
    labelBehavior,
  };
}
