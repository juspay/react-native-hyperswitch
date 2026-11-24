# What the hosted bundles were built from

Written by `bundle/build.mjs`. Do not edit by hand: rebuild instead.

| | |
|---|---|
| Vault version | 1.0.5 |
| Vault source | commit `6226bb56de91e8cb1c309f1731fd7f7ec5c69144` |
| Hosted JavaScript before bundling | `bundle/build/vault-fields.js`, 349311 bytes, sha1 `11800b6ec66517ef041715f0d02e62bb1e98ecc8` |
| react-native | 0.86.0 |
| react | 19.2.3 |
| react-native-svg | 15.15.5 |
| metro | 0.84.6 |
| node | v26.12.1 |
| Mode | production, minified, plain JavaScript (not Hermes bytecode) |

| Platform | File | Bytes | sha1 |
|---|---|---|---|
| android | `android/src/main/assets/hyperswitch-vault-fields.bundle` | 1177887 | `d73a138b2295c373f59b5ce28f54e338f89b40ea` |
| ios | `ios/Resources/hyperswitch-vault-fields.bundle` | 1172538 | `fde945eafdbc737e51b83cca8f56ccc83d17230b` |

The bundle carries the JavaScript of the react-native and react-native-svg versions above. It runs
in the app's own native React Native and react-native-svg, so it is used only in apps whose React
Native version is in the vault's tested range.
