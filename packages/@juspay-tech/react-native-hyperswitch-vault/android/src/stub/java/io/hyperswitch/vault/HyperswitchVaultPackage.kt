package io.hyperswitch.vault

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/*
 * What an app links when the vault's own engine cannot run in it: React Native older than the
 * bundle is built for, the old architecture, or the app chose to build without the native fields
 * (android/build.gradle decides). It registers nothing. The vault's JavaScript finds no native
 * module and renders the card fields in plain JavaScript, as it did before there was a native path.
 *
 * The class has the same name as the real package because autolinking names it in the app's
 * generated code either way. It uses only what every supported React Native version has.
 */
class HyperswitchVaultPackage : ReactPackage {
  @Deprecated("The app's React Native calls this on the old architecture only.")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = emptyList()

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
