package com.hyperswitchsamsungpay

import android.app.Activity
import android.util.Log
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext

class HyperswitchSamsungPayModule(reactContext: ReactApplicationContext) :
  NativeHyperswitchSamsungPaySpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  override fun checkSamsungPayValidity(requestObj: String, callback: Callback) {
    try {
      SamsungPayController.parseSamsungPayInfo(requestObj, callback)
      SamsungPayController.setSamsungPayContext(reactApplicationContext.currentActivity!! as Activity)
      SamsungPayController.checkSamsungPayStatus(callback)
    } catch (err: Exception) {
      Log.i("SPAYValidityCheckFail", err.message.toString())
    }
  }

  override fun activateSamsungPay(callback: Callback) {
    SamsungPayController.activateSamsungPay(callback)
  }

  override fun presentSamsungPayPaymentSheet(callback: Callback) {
    SamsungPayController.presentSamsungPayPaymentSheet(callback)
  }

  companion object {
    const val NAME = "HyperswitchSamsungPay"
  }
}
