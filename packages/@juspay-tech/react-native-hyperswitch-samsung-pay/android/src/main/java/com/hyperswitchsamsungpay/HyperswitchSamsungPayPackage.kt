package com.hyperswitchsamsungpay

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class HyperswitchSamsungPayPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == HyperswitchSamsungPayModule.NAME) {
      HyperswitchSamsungPayModule(reactContext)
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      moduleInfos[HyperswitchSamsungPayModule.NAME] = ReactModuleInfo(
        HyperswitchSamsungPayModule.NAME,
        HyperswitchSamsungPayModule.NAME,
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
