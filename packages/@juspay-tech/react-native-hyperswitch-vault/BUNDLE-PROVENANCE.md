# What the hosted bundles were built from

Written by `bundle/build.mjs`. Do not edit by hand: rebuild instead.

| | |
|---|---|
| Vault version | 1.0.5 |
| Vault source | commit `b7908b8e8f604e7c7ea3cea0a66a2976ea98ce43` |
| Hosted JavaScript before bundling | `bundle/build/vault-fields.js`, 351019 bytes, sha1 `c9d5d957d2fb9b02a306b8b1dfb15d582c3063b2` |
| react-native | 0.86.0 |
| react | 19.2.3 |
| react-native-svg | 15.15.5 |
| @juspay-tech/react-native-hyperswitch-scancard | 0.3.1 |
| metro | 0.84.6 |
| node | v26.12.1 |
| Mode | production, minified, plain JavaScript (not Hermes bytecode) |

| Platform | File | Bytes | sha1 |
|---|---|---|---|
| android | `android/src/main/assets/hyperswitch-vault-fields.bundle` | 1178711 | `e58f247923234133c3dfc25cee0c8d09106a9ec7` |
| ios | `ios/Resources/hyperswitch-vault-fields.bundle` | 1173362 | `11c34a862f029203801f31ba8593a04dda671ea2` |

The bundle carries the JavaScript of the react-native, react-native-svg and scan-card versions above.
It runs in the app's own native React Native, react-native-svg and scan-card (when the app has it),
so it is used only in apps whose React Native version is in the vault's tested range.
