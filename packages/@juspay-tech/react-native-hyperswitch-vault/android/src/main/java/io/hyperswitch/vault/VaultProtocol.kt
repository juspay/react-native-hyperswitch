package io.hyperswitch.vault

/*
 * The names this native code shares with the vault's hosted bundle (src/hosted/protocol.mjs) and
 * with the vault's JavaScript in the merchant's engine (src/native). All three hold a copy;
 * VERSION is how they notice they have drifted. Nothing else in this folder spells these names.
 */
internal object VaultProtocol {
  const val VERSION = 1

  /* The bundle the vault's own engine runs, and the name of its main module. */
  const val BUNDLE_NAME = "hyperswitch-vault-fields.bundle"
  const val ENTRY_FILE = "index.vault-fields"

  /* The roots the bundle registers. */
  const val FORM_ROOT = "HyperswitchVaultForm"
  const val FIELD_ROOT = "HyperswitchVaultField"

  const val FORM_MOUNTED = "VAULT_FORM_MOUNTED"
  const val FORM_ERROR = "VAULT_FORM_ERROR"
  const val COMMAND_RESULT = "VAULT_COMMAND_RESULT"

  /* The lowest React Native minor version the bundle is built for. */
  const val MIN_REACT_NATIVE_MINOR = 82
}

/* Receives the events of one React root in the vault's engine. Called on the main thread. */
internal fun interface VaultEventTarget {
  fun onVaultEvent(name: String, payloadJson: String)
}
