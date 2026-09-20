import { describe, it, expect, jest, afterEach } from '@jest/globals';

import { toVaultAppearance } from '../appearance';
import type { Appearance } from '../../../core/types';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('toVaultAppearance', () => {
  it('maps react-native-hyperswitch colors to the vault variables, per scheme', () => {
    const layer: Appearance = {
      colors: {
        light: {
          primary: '#0570DE',
          componentText: '#1A1A1A',
          placeholderText: '#9E9E9E',
          componentBackground: '#FFFFFF',
          componentBorder: '#E0E0E0',
          error: '#D32F2F',
        },
        dark: {
          primary: '#8AB4F8',
          componentText: '#FFFFFF',
          componentBackground: '#121212',
        },
      },
    };

    expect(toVaultAppearance([layer], 'light')?.variables).toEqual({
      colorPrimary: '#0570DE',
      colorText: '#1A1A1A',
      colorTextPlaceholder: '#9E9E9E',
      colorBackground: '#FFFFFF',
      borderColor: '#E0E0E0',
      colorDanger: '#D32F2F',
    });
    expect(toVaultAppearance([layer], 'dark')?.variables).toEqual({
      colorPrimary: '#8AB4F8',
      colorText: '#FFFFFF',
      colorBackground: '#121212',
    });
  });

  it('falls back to light when the dark scheme is not given', () => {
    const layer: Appearance = { colors: { light: { primary: '#0570DE' } } };
    expect(toVaultAppearance([layer], 'dark')?.variables).toEqual({
      colorPrimary: '#0570DE',
    });
  });

  it('maps shapes and font, and takes the sheet-only colors nowhere', () => {
    const layer: Appearance = {
      colors: { light: { overlay: '#000000', loaderBackground: '#EEEEEE' } },
      shapes: { borderRadius: 8, borderWidth: 1, inputHeight: 48, gap: 12 },
      font: { family: 'Inter', scale: 1.1, errorTextSizeAdjust: 2 },
    };
    expect(toVaultAppearance([layer], 'light')?.variables).toEqual({
      borderRadius: 8,
      borderWidth: 1,
      inputFieldHeight: 48,
      gap: 12,
      fontFamily: 'Inter',
      fontScale: 1.1,
      errorTextSizeAdjust: 2,
    });
  });

  it('layers later appearances over earlier ones and keeps the last valid labels', () => {
    const session: Appearance = {
      colors: { light: { primary: '#0570DE', error: '#D32F2F' } },
      labels: 'above',
    };
    const form: Appearance = { colors: { light: { primary: '#111111' } } };

    const out = toVaultAppearance([session, form], 'light');
    expect(out?.variables).toEqual({
      colorPrimary: '#111111',
      colorDanger: '#D32F2F',
    });
    expect(out?.labels).toBe('above');
  });

  it('drops values of the wrong runtime type and empty strings', () => {
    const loose = (value: unknown) => value as never;
    const layer: Appearance = {
      colors: { light: { primary: '', componentText: loose(42) } },
      shapes: { borderRadius: loose('8'), inputHeight: loose(Number.NaN) },
    };
    expect(toVaultAppearance([layer], 'light')).toBeUndefined();
  });

  it('warns and ignores an unknown labels value', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const layer = { labels: 'sideways' } as unknown as Appearance;
    expect(toVaultAppearance([layer], 'light')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('appearance.labels')
    );
  });
});
