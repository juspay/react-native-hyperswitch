import { StyleSheet } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import type {
  Appearance,
  AppearanceVariables,
  ElementType,
  FieldStyles,
} from './types';

const VIEW_STYLE_KEYS = ['root', 'container', 'accessory'] as const;
const TEXT_STYLE_KEYS = ['input', 'placeholder', 'label', 'error'] as const;

export function resolveFieldStyles(
  appearances: readonly Appearance[] | undefined,
  elementType: ElementType,
  own: FieldStyles | undefined
): FieldStyles {
  const layers = appearances ?? [];
  const view: Record<string, StyleProp<ViewStyle>[]> = {};
  const text: Record<string, StyleProp<TextStyle>[]> = {};
  for (const key of VIEW_STYLE_KEYS) view[key] = [];
  for (const key of TEXT_STYLE_KEYS) text[key] = [];

  const collect = (source: FieldStyles | undefined) => {
    if (!source) return;
    for (const key of VIEW_STYLE_KEYS) {
      const value = source[key];
      if (value) view[key]!.push(value);
    }
    for (const key of TEXT_STYLE_KEYS) {
      const value = source[key];
      if (value) text[key]!.push(value);
    }
  };

  for (const layer of layers) collect(layer);
  for (const layer of layers) collect(layer.fields?.[elementType]);
  collect(own);

  const styles: FieldStyles = {};
  for (const key of VIEW_STYLE_KEYS) {
    if (view[key]!.length) styles[key] = StyleSheet.flatten(view[key]!);
  }
  for (const key of TEXT_STYLE_KEYS) {
    if (text[key]!.length) styles[key] = StyleSheet.flatten(text[key]!);
  }
  return styles;
}

/**
 * Merges the flat `variables` theming primitives across appearance layers — later layers
 * (session appearance, then the per-`<CardForm>`/per-field appearance) win field for field.
 * Unlike `FieldStyles`, these aren't scoped per element type: they theme the vault's own
 * rendering as a whole (only the `hyperswitch` adapter currently honors them).
 */
export function resolveAppearanceVariables(
  appearances: readonly Appearance[] | undefined
): AppearanceVariables | undefined {
  const layers = appearances ?? [];
  let merged: AppearanceVariables | undefined;
  for (const layer of layers) {
    if (!layer.variables) continue;
    merged = { ...merged, ...layer.variables };
  }
  return merged;
}
