package com.reactnativehyperswitchnetcetera3ds

import android.app.Activity
import android.app.Application
import android.util.Log
import androidx.annotation.Nullable
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HyperswitchNetcetera3dsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  val hsNetceteraUtils = HsNetceteraUtils()
  val applicationContext = reactApplicationContext.applicationContext as Application
  val activity = currentActivity ?: reactApplicationContext.currentActivity

  override fun getName(): String {
    return "HyperswitchNetcetera3ds"
  }

  @ReactMethod
  fun initialiseNetceteraSDK(
    apiKey: String, hsSDKEnvironment: String, callback: Callback
  ) {

    try {
      HsNetceteraConfigurator.setConfigParameters(
        applicationContext, hsNetceteraUtils.hsSdkEnvironmetMapper(hsSDKEnvironment), apiKey
      )
      hsNetceteraUtils.intialiseNetceteraSDK(applicationContext, callback)

    } catch (err: Exception) {
      val map = Arguments.createMap()
      map.putString("status", "failure")
      map.putString("message", "netcetera sdk initialization fail" + err.message)
      callback.invoke(map)
    }
  }

  @ReactMethod
  fun generateAReqParams(
    messageVersion: String, directoryServerId: String, callback: Callback
  ) {
    hsNetceteraUtils.generateAReqParams(activity, messageVersion, directoryServerId, callback)
  }

  @ReactMethod
  fun recieveChallengeParamsFromRN(
    acsSignedContent: String,
    acsRefNumber: String,
    acsTransactionId: String,
    @Nullable threeDSRequestorAppURL: String?,
    threeDSServerTransId: String,
    callback: Callback
  ) {
    val challengeParameters = HsNetceteraConfigurator.getChallengeParams(
      acsRefNumber,
      acsSignedContent,
      acsTransactionId,
      threeDSRequestorAppURL,
      threeDSServerTransId,
    )
    hsNetceteraUtils.setChallengeParameter(challengeParameters, callback)
  }

  @ReactMethod
  fun generateChallenge(callback: Callback) {
    hsNetceteraUtils.generateChallenge(activity, 5, callback)
  }
}
