package com.juspaytech.reactnativehyperswitchpaypal

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class ReactNativeHyperswitchPaypalPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == ReactNativeHyperswitchPaypalModule.NAME) {
      ReactNativeHyperswitchPaypalModule(reactContext)
    } else {
      null
    }
  }

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> {
    return listOf(PaypalButtonViewManager())
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      moduleInfos[ReactNativeHyperswitchPaypalModule.NAME] = ReactModuleInfo(
        ReactNativeHyperswitchPaypalModule.NAME,
        ReactNativeHyperswitchPaypalModule.NAME,
        // Positional: React Native 0.76 names these parameters differently.
        false, // canOverrideExistingModule
        false, // needsEagerInit
        false, // isCxxModule
        true // isTurboModule
      )
      moduleInfos
    }
  }
}
