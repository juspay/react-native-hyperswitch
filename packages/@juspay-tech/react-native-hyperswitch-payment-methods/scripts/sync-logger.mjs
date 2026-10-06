/*
 * Copies the shared logger's built output (shared/logger/dist) into
 * src/telemetry/vendor/hyperswitch-logger, so this package ships the logger inside itself and
 * depends on nothing unpublished. The logger is a temporary in-repo package: the vault carries a
 * copy of its ReScript sources (its own scripts/sync-logger.mjs), and this package this copy.
 *
 * Run `yarn sync:logger` after changing anything under shared/logger; it rebuilds the logger
 * first. src/telemetry/__tests__/vendorSync.test.ts fails while the copy is stale.
 */
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, '../../../shared/logger/dist');
const target = join(root, 'src/telemetry/vendor/hyperswitch-logger');

const HEADER =
  '/* Copied from shared/logger/dist by scripts/sync-logger.mjs. Do not edit: change shared/logger and run `yarn sync:logger`. */\n';

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

writeFileSync(
  join(target, 'index.js'),
  HEADER + readFileSync(join(dist, 'esm/index.js'), 'utf8')
);
for (const file of readdirSync(join(dist, 'types'))) {
  if (file.endsWith('.d.ts')) {
    copyFileSync(join(dist, 'types', file), join(target, file));
  }
}
writeFileSync(
  join(target, 'index.d.ts'),
  HEADER + readFileSync(join(target, 'index.d.ts'), 'utf8')
);

console.log(`Copied the shared logger into ${target}`);
