// const path = require('path');
// const { getDefaultConfig } = require('@react-native/metro-config');
// const { withMetroConfig } = require('react-native-monorepo-config');

// const root = path.resolve(__dirname, '..');

// /**
//  * Metro configuration
//  * https://facebook.github.io/metro/docs/configuration
//  *
//  * @type {import('metro-config').MetroConfig}
//  */
// module.exports = withMetroConfig(getDefaultConfig(__dirname), {
//   root,
//   dirname: __dirname,
// });
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { getConfig } = require('react-native-builder-bob/metro-config');
const pkg = require('../package.json');
const root = path.resolve(__dirname, '..');
/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = getConfig(getDefaultConfig(__dirname), {
  root,
  pkg,
  project: __dirname,
});
// Add @babel/runtime and all ReScript packages to extraNodeModules so Metro can resolve them
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@babel/runtime': path.join(__dirname, 'node_modules/@babel/runtime'),
};
// Add all ReScript packages to watch folders so Metro can find deep imports
config.watchFolders = [...config.watchFolders];
module.exports = config;
