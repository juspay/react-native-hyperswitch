const path = require('path');

module.exports = {
  project: {
    ios: {
      automaticPodsInstallation: true,
    },
  },
  dependencies: {
    '@juspay-tech/react-native-hyperswitch': {
      root: path.join(__dirname, '..', 'packages', '@juspay-tech', 'react-native-hyperswitch'),
    },
    '@juspay-tech/react-native-hyperswitch-click-to-pay': {
      root: path.join(__dirname, '..', 'packages', '@juspay-tech', 'react-native-hyperswitch-click-to-pay'),
    },
    '@juspay-tech/react-native-hyperswitch-netcetera-3ds': {
      root: path.join(__dirname, '..', 'packages', '@juspay-tech', 'react-native-hyperswitch-netcetera-3ds'),
    },
    '@juspay-tech/react-native-hyperswitch-scancard': {
      root: path.join(__dirname, '..', 'packages', '@juspay-tech', 'react-native-hyperswitch-scancard'),
    },
    '@juspay-tech/react-native-hyperswitch-paypal': {
      root: path.join(__dirname, '..', 'packages', '@juspay-tech', 'react-native-hyperswitch-paypal'),
    },
    '@juspay-tech/react-native-hyperswitch-payment-methods': {
      root: path.join(__dirname, '..', 'packages', '@juspay-tech', 'react-native-hyperswitch-payment-methods'),
    },
  },
};
