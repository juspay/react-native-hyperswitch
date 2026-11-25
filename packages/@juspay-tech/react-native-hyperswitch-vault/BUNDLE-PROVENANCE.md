# What the hosted bundles were built from

Written by `bundle/build.mjs`. Do not edit by hand: rebuild instead.

| | |
|---|---|
| Vault version | 1.0.5 |
| Vault source | commit `c1ca1ac2d85f45b8aa684ad82eae4a051551a7ac` |
| Hosted JavaScript before bundling | `bundle/build/vault-fields.js`, 350775 bytes, sha1 `22a872bda3384974272601dae9aaebec13fcb875` |
| react-native | 0.86.0 |
| react | 19.2.3 |
| react-native-svg | 15.15.5 |
| @juspay-tech/react-native-hyperswitch-scancard | 0.3.1 |
| metro | 0.84.6 |
| node | v26.12.1 |
| Mode | production, minified, plain JavaScript (not Hermes bytecode) |

| Platform | File | Bytes | sha1 |
|---|---|---|---|
| android | `android/src/main/assets/hyperswitch-vault-fields.bundle` | 1178706 | `ca3172957c8c03ae91b2999c36077aa0eb8ee1e4` |
| ios | `ios/Resources/hyperswitch-vault-fields.bundle` | 1173357 | `e2286e7058f444ca4beb07ef60c3e935e52b7e7c` |

The bundle carries the JavaScript of the react-native, react-native-svg and scan-card versions above.
It runs in the app's own native React Native, react-native-svg and scan-card (when the app has it),
so it is used only in apps whose React Native version is in the vault's tested range.
