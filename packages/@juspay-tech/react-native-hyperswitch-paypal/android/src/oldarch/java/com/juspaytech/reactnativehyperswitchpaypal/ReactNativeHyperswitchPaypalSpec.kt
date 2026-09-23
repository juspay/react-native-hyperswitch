package com.juspaytech.reactnativehyperswitchpaypal

import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

abstract class ReactNativeHyperswitchPaypalSpec internal constructor(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  abstract fun launchPayPal(requestObj: String, callback: Callback)
}
