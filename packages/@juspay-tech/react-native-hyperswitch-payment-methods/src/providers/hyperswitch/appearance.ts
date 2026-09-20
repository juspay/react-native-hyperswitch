import type { Appearance, AppearanceVariables } from '../../core/types';
import { APPEARANCE_LABELS, pickAllowed } from '../../core/validate';

export interface VaultAppearance {
  variables?: AppearanceVariables;
  labels?: 'above' | 'floating' | 'never';
}

const STRING_KEYS = [
  'colorPrimary',
  'colorText',
  'colorDanger',
  'colorTextPlaceholder',
  'colorBackground',
  'borderColor',
  'fontFamily',
] as const;
const NUMBER_KEYS = ['borderRadius', 'inputFieldHeight'] as const;

function sanitizeVariables(
  variables: AppearanceVariables
): AppearanceVariables {
  const out: AppearanceVariables = {};
  for (const key of STRING_KEYS) {
    const value = variables[key];
    if (typeof value === 'string' && value !== '') out[key] = value;
  }
  for (const key of NUMBER_KEYS) {
    const value = variables[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

export function toVaultAppearance(
  layers: readonly Appearance[]
): VaultAppearance | undefined {
  let variables: AppearanceVariables | undefined;
  let labels: VaultAppearance['labels'];
  for (const layer of layers) {
    if (layer.variables && typeof layer.variables === 'object') {
      variables = {
        ...(variables ?? {}),
        ...sanitizeVariables(layer.variables),
      };
    }
    const layerLabels = pickAllowed(
      layer.labels,
      APPEARANCE_LABELS,
      'appearance.labels'
    );
    if (layerLabels) labels = layerLabels;
  }
  if (!variables && !labels) return undefined;
  const out: VaultAppearance = {};
  if (variables) out.variables = variables;
  if (labels) out.labels = labels;
  return out;
}
