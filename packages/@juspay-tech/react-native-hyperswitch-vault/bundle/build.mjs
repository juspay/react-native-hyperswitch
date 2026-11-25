/*
 * Builds hyperswitch-vault-fields.bundle for Android and iOS and records what each was built from.
 *
 *     yarn build            in the vault package   (rescript, types, rollup: writes bundle/build/)
 *     npm ci && npm run build   in this folder     (Metro: writes the two bundles and the record)
 *
 * WHY A TOOLCHAIN OF ITS OWN. A bundle carries React Native's own JavaScript, and that JavaScript
 * must fit the native React Native of the app the bundle runs in. So the bundle is built with one
 * pinned React Native (package.json here, exact versions, locked by package-lock.json), whatever
 * version the monorepo's workspaces are on. Changing the pin changes which apps the bundle runs
 * in: the vault's tested-versions range must be re-run when it moves.
 *
 * The bundles are plain JavaScript text, not Hermes bytecode: bytecode is tied to one Hermes
 * version, and the engine that runs this is the app's.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const vault = join(here, '..');
const require = createRequire(import.meta.url);

const BUNDLE = 'hyperswitch-vault-fields.bundle';
const ENTRY = join(here, 'index.vault-fields.js');
const INPUT = join(here, 'build', 'vault-fields.js');
const OUTPUTS = {
  android: join(vault, 'android', 'src', 'main', 'assets', BUNDLE),
  ios: join(vault, 'ios', 'Resources', BUNDLE),
};

if (!existsSync(INPUT)) {
  console.error(`Missing ${relative(vault, INPUT)}. Run "yarn build" in the vault package first.`);
  process.exit(1);
}

const versionOf = (name) => require(`${name}/package.json`).version;
const sha1 = (file) => createHash('sha1').update(readFileSync(file)).digest('hex');
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: vault, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const { loadConfig } = require('metro-config');
const Metro = require('metro');
const config = await loadConfig({ cwd: here, config: join(here, 'metro.config.js') });

const built = [];
for (const [platform, out] of Object.entries(OUTPUTS)) {
  mkdirSync(dirname(out), { recursive: true });
  await Metro.runBuild(config, { entry: ENTRY, out, platform, dev: false, minify: true });
  /* Metro adds ".js" to an output name that has another extension. */
  if (existsSync(`${out}.js`)) renameSync(`${out}.js`, out);
  built.push({ platform, file: relative(vault, out), bytes: statSync(out).size, sha1: sha1(out) });
}

const commit = git('rev-parse', 'HEAD');
const dirty = git('status', '--porcelain', '--', 'src', 'shared-code', 'rollup.config.mjs') !== '';
const record = `# What the hosted bundles were built from

Written by \`bundle/build.mjs\`. Do not edit by hand: rebuild instead.

| | |
|---|---|
| Vault version | ${JSON.parse(readFileSync(join(vault, 'package.json'), 'utf8')).version} |
| Vault source | commit \`${commit || 'unknown'}\`${dirty ? ' **plus uncommitted changes**' : ''} |
| Hosted JavaScript before bundling | \`bundle/build/vault-fields.js\`, ${statSync(INPUT).size} bytes, sha1 \`${sha1(INPUT)}\` |
| react-native | ${versionOf('react-native')} |
| react | ${versionOf('react')} |
| react-native-svg | ${versionOf('react-native-svg')} |
| @juspay-tech/react-native-hyperswitch-scancard | ${versionOf('@juspay-tech/react-native-hyperswitch-scancard')} |
| metro | ${versionOf('metro')} |
| node | ${process.version} |
| Mode | production, minified, plain JavaScript (not Hermes bytecode) |

| Platform | File | Bytes | sha1 |
|---|---|---|---|
${built.map((one) => `| ${one.platform} | \`${one.file}\` | ${one.bytes} | \`${one.sha1}\` |`).join('\n')}

The bundle carries the JavaScript of the react-native, react-native-svg and scan-card versions above.
It runs in the app's own native React Native, react-native-svg and scan-card (when the app has it),
so it is used only in apps whose React Native version is in the vault's tested range.
`;
writeFileSync(join(vault, 'BUNDLE-PROVENANCE.md'), record);

for (const one of built) console.log(`${one.platform}: ${one.file}  ${one.bytes} bytes  ${one.sha1}`);
console.log(dirty ? 'NOTE: built from uncommitted source.' : `built from ${commit}`);
