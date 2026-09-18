/*
 * Runtime validation of the web-shaped options. TypeScript narrows these for
 * typed callers; JavaScript callers and dynamic data reach the runtime, where
 * the web SDK warns and falls back to the default. Mirror that.
 */
import type {
  AppearanceLabels,
  AppearanceTheme,
  CardBrandIconDisplay,
  CvcIconDisplay,
} from './types';

export const CVC_ICONS: readonly CvcIconDisplay[] = ['hidden', 'default'];
export const CARD_BRAND_ICONS: readonly CardBrandIconDisplay[] = [
  'standard',
  'hidden',
  'animated',
  'hideGeneric',
];
export const APPEARANCE_LABELS: readonly AppearanceLabels[] = [
  'above',
  'floating',
  'none',
];
export const APPEARANCE_THEMES: readonly AppearanceTheme[] = [
  'default',
  'midnight',
  'brutal',
  'charcoal',
  'soft',
  'bubblegum',
  'none',
];

export function warnUnknownValue(
  value: unknown,
  allowed: readonly string[],
  path: string
): void {
  if (!__DEV__) return;
  console.warn(
    `[payment-methods] Unknown value ${JSON.stringify(value)} for ${path}; expected one of ${allowed.join(', ')}. Using the default.`
  );
}

/**
 * A string from `allowed`, or undefined (the default) after a development
 * warning. `undefined`, `null` and `''` mean "not set" without a warning, as
 * the web SDK treats them.
 */
export function pickAllowed<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (
    typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
  ) {
    return value as T;
  }
  warnUnknownValue(value, allowed, path);
  return undefined;
}

/** A string, else undefined: the web SDK applies `placeholder` only when it is a string. */
export function pickString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** String entries of an array, else undefined; non-string entries warn as on web. */
export function pickStringArray(
  value: unknown,
  path: string
): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') strings.push(entry);
    else warnUnknownValue(entry, ['string'], path);
  }
  return strings;
}
