package com.juspaytech.reactnativehyperswitchpaypal

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import org.json.JSONObject

class ReactNativeHyperswitchPaypalModule(reactContext: ReactApplicationContext) :
  ReactNativeHyperswitchPaypalSpec(reactContext),
  PayPalPendingResult.PayPalResultCallback {

  private var currentCallback: Callback? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun getName(): String = NAME

  @ReactMethod
  override fun launchPayPal(requestObj: String, callback: Callback) {

    try {
      val json = JSONObject(requestObj)
      val clientId = json.getString("clientId")
      val environment = json.optString("environment", "SANDBOX")
      val orderId = json.getString("orderId")
      val returnUrl = json.optString("returnUrl", "").ifEmpty {
        "${reactApplicationContext.packageName}.paypal"
      }
      val fundingSource = json.optString("fundingSource", "PAYPAL")

      currentCallback = callback

      // Register for result callback
      PayPalPendingResult.setCallback(this)

      // Launch PayPalRedirectActivity with parameters
      val intent = Intent(reactApplicationContext, PayPalRedirectActivity::class.java).apply {
        putExtra("clientId", clientId)
        putExtra("environment", environment)
        putExtra("orderId", orderId)
        putExtra("returnUrl", returnUrl)
        putExtra("fundingSource", fundingSource)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)

    } catch (e: Exception) {
      Log.e(TAG, "Exception in launchPayPal: ${e.message}", e)
      invokeCallbackWithError(e.message ?: "Failed to launch PayPal checkout")
    }
  }

  // Called from PayPalRedirectActivity on success
  override fun onSuccess(orderId: String, payerId: String) {
    mainHandler.post {
      val map = WritableNativeMap()
      map.putString("status", "success")
      map.putString("orderId", orderId)
      map.putString("payerId", payerId)
      currentCallback?.invoke(map)
      currentCallback = null
    }
  }

  // Called from PayPalRedirectActivity on cancel
  override fun onCancelled() {
    mainHandler.post {
      val map = WritableNativeMap()
      map.putString("status", "cancelled")
      currentCallback?.invoke(map)
      currentCallback = null
    }
  }

  // Called from PayPalRedirectActivity on failure
  override fun onFailure(errorMessage: String, errorCode: String?) {
    mainHandler.post {
      Log.e(TAG, "PayPal failure: $errorMessage")
      invokeCallbackWithError(errorMessage)
    }
  }

  private fun invokeCallbackWithError(errorMessage: String) {
    Log.e(TAG, "PayPal error: $errorMessage")
    val map = WritableNativeMap()
    map.putString("status", "failed")
    map.putString("error_message", errorMessage)
    currentCallback?.invoke(map)
    currentCallback = null
  }

  companion object {
    const val NAME = "HyperswitchPaypal"
    private const val TAG = "HyperswitchPaypal"
  }
}
