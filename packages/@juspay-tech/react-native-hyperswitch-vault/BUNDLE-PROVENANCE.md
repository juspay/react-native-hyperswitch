# What the hosted bundles were built from

Written by `bundle/build.mjs`. Do not edit by hand: rebuild instead.

| | |
|---|---|
| Vault version | 1.0.5 |
| Vault source | commit `8051eeaf7a50fd81fdc44148ed472659564a583e` |
| Hosted JavaScript before bundling | `bundle/build/vault-fields.js`, 349067 bytes, sha1 `0f6bb065f4213af121f6784b9aa12725641d7cff` |
| react-native | 0.86.0 |
| react | 19.2.3 |
| react-native-svg | 15.15.5 |
| metro | 0.84.6 |
| node | v26.12.1 |
| Mode | production, minified, plain JavaScript (not Hermes bytecode) |

| Platform | File | Bytes | sha1 |
|---|---|---|---|
| android | `android/src/main/assets/hyperswitch-vault-fields.bundle` | 1177887 | `c56f6b4ad8c1de992ccb80b3a5b28a2fd5e691fe` |
| ios | `ios/Resources/hyperswitch-vault-fields.bundle` | 1172538 | `b03871dbcd5ccbe8ba4a84c7120b786556cd6175` |

The bundle carries the JavaScript of the react-native and react-native-svg versions above. It runs
in the app's own native React Native and react-native-svg, so it is used only in apps whose React
Native version is in the vault's tested range.
