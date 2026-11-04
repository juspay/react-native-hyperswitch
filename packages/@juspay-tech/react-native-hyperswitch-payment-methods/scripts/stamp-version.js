/* Writes package.json's version into src/logging/version.ts before each build, as the vault's
   build stamps VaultVersion, so a release's logs carry the version it was released as. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const file = path.join(root, 'src', 'logging', 'version.ts');
const source = fs.readFileSync(file, 'utf8');
const stamped = source.replace(
  /export const SDK_VERSION = '[^']*';/,
  `export const SDK_VERSION = '${version}';`
);
if (stamped === source && !source.includes(`'${version}'`)) {
  throw new Error(`Could not stamp version ${version} into ${file}`);
}
if (stamped !== source) fs.writeFileSync(file, stamped);
