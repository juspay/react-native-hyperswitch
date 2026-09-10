package com.hyperswitchsdkreactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import com.hyperswitchsdkreactnative.modules.NativeWidgetHelperModule
import com.hyperswitchsdkreactnative.modules.ReactNativeHyperswitchModule
import com.hyperswitchsdkreactnative.views.PaymentElementViewManager
import io.hyperswitch.googlepay.HyperGooglePayButtonManager
import io.hyperswitch.react.GooglePayButtonManager
import io.hyperswitch.react.HyperHeadlessModule
import io.hyperswitch.react.HyperModule
import java.util.ArrayList

class HyperswitchSdkReactNativePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      HyperModule.NAME -> HyperModule(reactContext)
      HyperHeadlessModule.NAME -> HyperHeadlessModule(reactContext)
      ReactNativeHyperswitchModule.NAME -> ReactNativeHyperswitchModule(reactContext)
      NativeWidgetHelperModule.NAME -> NativeWidgetHelperModule(reactContext)
      else -> null
    }
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    val viewManagers: MutableList<ViewManager<*, *>> = ArrayList()
    viewManagers.add(GooglePayButtonManager())
    viewManagers.add(HyperGooglePayButtonManager())
    viewManagers.add(PaymentElementViewManager())
    return viewManagers
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      arrayOf(
        HyperModule.NAME,
        HyperHeadlessModule.NAME,
        ReactNativeHyperswitchModule.NAME,
        NativeWidgetHelperModule.NAME,
      ).associateWith {
        ReactModuleInfo(it, it, false, false, false, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED)
      }.toMutableMap()
    }
  }
}
