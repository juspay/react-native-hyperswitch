/*
 * Copies the shared logger's ReScript sources (shared/logger/src) into src/logger, so the vault
 * compiles them as its own modules and depends on no unpublished package. The logger is a
 * temporary in-repo package; payment-methods carries its built output the same way.
 *
 * Run `yarn sync:logger` after changing anything under shared/logger. payment-methods'
 * src/telemetry/__tests__/vendorSync.test.ts fails while this copy is stale.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "../../../shared/logger/src");
const target = join(root, "src/logger");

/* The modules the vault uses, and the two files they need. */
const FILES = [
  "LoggerTypes.res",
  "LoggerUtils.res",
  "LoggerCore.res",
  "LoggerCrashBoundary.res",
  "CrashBoundary.mjs",
  "jsonValue.ts",
];

const NOTE =
  "Copied from shared/logger/src by scripts/sync-logger.mjs. Do not edit: change shared/logger and run `yarn sync:logger` in the vault package.";

mkdirSync(target, { recursive: true });
for (const file of FILES) {
  const header = file.endsWith(".res") ? `// ${NOTE}\n` : `/* ${NOTE} */\n`;
  writeFileSync(
    join(target, file),
    header + readFileSync(join(source, file), "utf8"),
  );
}

console.log(`Copied the shared logger's sources into ${target}`);
