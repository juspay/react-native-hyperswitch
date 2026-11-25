package io.hyperswitch.vault

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/*
 * The module the hosted bundle talks to (src/hosted/bridge.mjs). It lives only in the vault's own
 * engine. Events come out of the bundle through it, already cut down to the allow-list by the
 * bundle and written as JSON text; commands go in.
 *
 * It passes the text on untouched and never logs it.
 */
internal class HyperswitchVaultHostedModule(
  context: ReactApplicationContext,
  private val engine: VaultEngine,
) : NativeHyperswitchVaultHostedSpec(context) {

  init {
    engine.attach(this)
  }

  override fun invalidate() {
    engine.detach(this)
    super.invalidate()
  }

  fun sendCommand(command: ReadableMap) = emitOnCommand(command)

  override fun emitFieldEvent(rootTag: Double, eventName: String, payload: String) =
    engine.deliver(rootTag.toInt(), eventName, payload)

  override fun emitFormEvent(rootTag: Double, eventName: String, payload: String) =
    engine.deliver(rootTag.toInt(), eventName, payload)
}

/* The one package that exists only for the vault's own engine. */
internal class HyperswitchVaultHostedPackage(private val engine: VaultEngine) : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NativeHyperswitchVaultHostedSpec.NAME) HyperswitchVaultHostedModule(reactContext, engine) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      NativeHyperswitchVaultHostedSpec.NAME to ReactModuleInfo(
        NativeHyperswitchVaultHostedSpec.NAME,
        NativeHyperswitchVaultHostedSpec.NAME,
        false, /* canOverrideExistingModule */
        false, /* needsEagerInit */
        false, /* isCxxModule */
        true, /* isTurboModule */
      ),
    )
  }
}
