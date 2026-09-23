package com.reactnativehyperswitchscancard

import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

abstract class HyperswitchScancardSpec internal constructor(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  abstract fun launchScanCard(scanCardRequest: String, callback: Callback)
}
