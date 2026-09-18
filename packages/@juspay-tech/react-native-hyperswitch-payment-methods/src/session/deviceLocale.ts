import { I18nManager } from 'react-native';

/**
 * The device locale as a BCP 47 tag, or undefined when the runtime exposes
 * none. Hermes' Intl carries the platform locale on both OSes; Android's
 * I18nManager also exports it (`fr_FR` style, normalised here). The vault
 * parses the tag with the same table the web SDK uses, so `fr-FR` and `fr`
 * both resolve to French and an unknown tag falls back to English.
 */
export function deviceLocale(): string | undefined {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof locale === 'string' && locale.trim()) return locale.trim();
  } catch {
    // Intl may be unavailable on a custom JS engine.
  }
  try {
    const constants = (
      I18nManager as {
        getConstants?: () => { localeIdentifier?: string | null };
      }
    ).getConstants?.();
    const identifier = constants?.localeIdentifier;
    if (typeof identifier === 'string' && identifier.trim()) {
      return identifier.trim().replace(/_/g, '-');
    }
  } catch {
    // Not running on a React Native host.
  }
  return undefined;
}

/**
 * The web SDK's rule: an explicit locale is used as given; omitted or
 * `'auto'` means the device (browser) language.
 */
export function resolveLocale(
  requested: string | null | undefined
): string | undefined {
  const trimmed = typeof requested === 'string' ? requested.trim() : '';
  if (trimmed && trimmed.toLowerCase() !== 'auto') return trimmed;
  return deviceLocale();
}
