package io.hyperswitch.vault

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

/*
 * What the merchant's app links: the forms module and the field view. The vault's own engine does
 * not load this package (see VaultEngine): it has HyperswitchVaultHostedPackage instead.
 */
class HyperswitchVaultPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NativeHyperswitchVaultFormsSpec.NAME) HyperswitchVaultFormsModule(reactContext) else null

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(HyperswitchVaultFieldViewManager())

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      NativeHyperswitchVaultFormsSpec.NAME to ReactModuleInfo(
        NativeHyperswitchVaultFormsSpec.NAME,
        NativeHyperswitchVaultFormsSpec.NAME,
        false, /* canOverrideExistingModule */
        false, /* needsEagerInit */
        false, /* isCxxModule */
        true, /* isTurboModule */
      ),
    )
  }
}
