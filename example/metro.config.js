const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = withMetroConfig(getDefaultConfig(__dirname), {
  root,
  dirname: __dirname,
});

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@juspay-tech/react-native-hyperswitch': path.resolve(
    root,
    'packages/@juspay-tech/react-native-hyperswitch'
  ),
  '@juspay-tech/react-native-hyperswitch-payment-methods': path.resolve(
    root,
    'packages/@juspay-tech/react-native-hyperswitch-payment-methods'
  ),
  '@juspay-tech/react-native-hyperswitch-vault': path.resolve(
    root,
    'packages/@juspay-tech/react-native-hyperswitch-vault'
  ),
  '@juspay-tech/react-native-hyperswitch-scancard': path.resolve(
    root,
    'packages/@juspay-tech/react-native-hyperswitch-scancard'
  ),
};

module.exports = config;