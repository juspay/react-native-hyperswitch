import { describe, it, expect } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/* src/telemetry/vendor/hyperswitch-logger must be the shared logger's current build, so this
   package and the vault (which compiles the logger in) send identical log lines. */

const vendor = join(__dirname, '../vendor/hyperswitch-logger');
const dist = join(__dirname, '../../../../../../shared/logger/dist');
const sources = join(__dirname, '../../../../../../shared/logger/src');
const vaultCopy = join(
  __dirname,
  '../../../../react-native-hyperswitch-vault/src/logger'
);

/* The vault's copy: ReScript sources, each behind a one-line "Copied from" header. */
const VAULT_FILES = [
  'LoggerTypes.res',
  'LoggerUtils.res',
  'LoggerCore.res',
  'LoggerCrashBoundary.res',
  'CrashBoundary.mjs',
  'jsonValue.ts',
];
const withoutFirstLine = (text: string) => text.slice(text.indexOf('\n') + 1);

const withoutHeader = (text: string) =>
  text.startsWith('/* Copied from shared/logger')
    ? text.slice(text.indexOf('\n') + 1)
    : text;

describe('vendored shared logger', () => {
  it('matches the shared logger build (run `yarn sync:logger` if not)', () => {
    if (!existsSync(join(dist, 'esm/index.js'))) {
      /* dist is gitignored. Locally the logger may simply not be built yet; CI runs `yarn
         test:ci`, which builds it first, so a missing build there is a failure. */
      if (process.env.CI) {
        throw new Error(
          'shared/logger/dist is missing: run `yarn workspace @juspay-tech/hyperswitch-logger build` first.'
        );
      }
      return;
    }
    expect(withoutHeader(readFileSync(join(vendor, 'index.js'), 'utf8'))).toBe(
      readFileSync(join(dist, 'esm/index.js'), 'utf8')
    );

    const declarations = readdirSync(join(dist, 'types')).filter((file) =>
      file.endsWith('.d.ts')
    );
    for (const file of declarations) {
      expect(withoutHeader(readFileSync(join(vendor, file), 'utf8'))).toBe(
        readFileSync(join(dist, 'types', file), 'utf8')
      );
    }
  });

  it("matches the vault's copy of the sources (run the vault's `yarn sync:logger` if not)", () => {
    for (const file of VAULT_FILES) {
      const copy = readFileSync(join(vaultCopy, file), 'utf8');
      expect(copy.split('\n')[0]).toContain('Copied from shared/logger/src');
      expect(withoutFirstLine(copy)).toBe(
        readFileSync(join(sources, file), 'utf8')
      );
    }
  });
});
