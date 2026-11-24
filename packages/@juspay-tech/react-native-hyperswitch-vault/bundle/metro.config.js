/* Everything resolves from this folder's own node_modules: the pinned React Native line and nothing
   from the monorepo around it. */
const { getDefaultConfig } = require('@react-native/metro-config');

module.exports = getDefaultConfig(__dirname);
