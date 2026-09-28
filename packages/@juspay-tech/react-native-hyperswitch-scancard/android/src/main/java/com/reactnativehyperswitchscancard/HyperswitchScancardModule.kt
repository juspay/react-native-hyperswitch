package com.reactnativehyperswitchscancard

import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import io.hyperswitch.scancard.ScanCardCallback
import io.hyperswitch.scancard.ScanCardManager

class HyperswitchScancardModule(reactContext: ReactApplicationContext) :
    NativeHyperswitchScancardSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  override fun launchScanCard(scanCardRequest: String, callback: Callback) {
    (reactApplicationContext.currentActivity as? FragmentActivity)?.let {
      ScanCardManager.launch(it, object : ScanCardCallback {
        override fun onScanResult(result: Map<String, Any?>) {
          val data = (result["data"] as? Map<*, *>)?.let { map ->
            map.entries.associate { (k, v) ->
              k.toString() to v?.toString()
            }
          } ?: mapOf()
          val pan = data["pan"] ?: ""

          val dataMap = Arguments.createMap()
          dataMap.putString("pan", pan)

          val map = Arguments.createMap()
          map.putString("status", result["status"] as String? ?: "Failed")
          map.putMap("data", dataMap)
          callback.invoke(map)
        }
      })
    }
  }

  companion object {
    const val NAME = "HyperswitchScancard"
  }
}
