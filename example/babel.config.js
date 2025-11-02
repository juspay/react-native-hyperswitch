const path = require('path');
const { getConfig } = require('react-native-builder-bob/babel-config');
const pkg1 = require('../packages/@juspay-tech/react-native-hyperswitch/package.json');
const pkg2 = require('../packages/@juspay-tech/react-native-hyperswitch-click-to-pay/package.json');
const pkg3 = require('../packages/@juspay-tech/react-native-hyperswitch-netcetera-3ds/package.json');
const pkg4 = require('../packages/@juspay-tech/react-native-hyperswitch-scancard/package.json');

const root1 = path.resolve(__dirname, '..', 'packages', '@juspay-tech', 'react-native-hyperswitch');
const root2 = path.resolve(__dirname, '..', 'packages', '@juspay-tech', 'react-native-hyperswitch-click-to-pay');
const root3 = path.resolve(__dirname, '..', 'packages', '@juspay-tech', 'react-native-hyperswitch-netcetera-3ds');
const root4 = path.resolve(__dirname, '..', 'packages', '@juspay-tech', 'react-native-hyperswitch-scancard');

module.exports = getConfig(
  {
    presets: ['module:@react-native/babel-preset'],
    plugins: ['module:react-native-dotenv'],
  },
  { root: root1, pkg: pkg1 },
  { root: root2, pkg: pkg2 },
  { root: root3, pkg: pkg3 },
  { root: root4, pkg: pkg4 },
);
