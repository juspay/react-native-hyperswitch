package com.hyperswitchsdkreactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import com.hyperswitchsdkreactnative.modules.HyperswitchSdkNativeModule
import com.hyperswitchsdkreactnative.modules.HyperswitchSdkReactNativeModule
import com.hyperswitchsdkreactnative.views.GooglePayButtonViewManager
import java.util.ArrayList

class HyperswitchSdkReactNativePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      HyperswitchSdkReactNativeModule.NAME -> HyperswitchSdkReactNativeModule(reactContext)
      HyperswitchSdkNativeModule.NAME -> HyperswitchSdkNativeModule(reactContext)
      else -> null
    }
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    val viewManagers: MutableList<ViewManager<*, *>> = ArrayList()
    viewManagers.add(GooglePayButtonViewManager())
    return viewManagers
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      arrayOf(HyperswitchSdkReactNativeModule.NAME, HyperswitchSdkNativeModule.NAME).associateWith {
        ReactModuleInfo(it, it, false, false, false, true)
      }.toMutableMap()
    }
  }
}
