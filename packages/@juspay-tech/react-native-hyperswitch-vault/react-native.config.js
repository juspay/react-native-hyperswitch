/*
 * The Android library holds two React packages: the one the merchant's app links (named here), and
 * the one the vault's own engine loads by itself. Naming the first stops autolinking from having
 * to guess.
 */
module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import io.hyperswitch.vault.HyperswitchVaultPackage;',
        packageInstance: 'new HyperswitchVaultPackage()',
      },
    },
  },
};
