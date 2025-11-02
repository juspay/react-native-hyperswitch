package com.hyperswitchtrident3ds

import android.app.Application
import androidx.annotation.Nullable
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HyperswitchTrident3dsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val hsTridentUtils = HsTridentUtils()
  private val applicationContext = reactApplicationContext.applicationContext as Application

  override fun getName(): String {
    return "HyperswitchTrident3ds"
  }

  @ReactMethod
  fun initialiseSDK(
    apiKey: String,
    hsSDKEnvironment: String,
    callback: Callback
  ) {
    try {
      hsTridentUtils.initialiseTridentSDK(applicationContext, callback)
    } catch (err: Exception) {
      val map = Arguments.createMap()
      map.putString("status", "failure")
      map.putString("message", "Trident SDK initialization failed: " + err.message)
      callback.invoke(map)
    }
  }

  @ReactMethod
  fun generateAReqParams(
    messageVersion: String,
    directoryServerId: String,
    cardNetwork: String,
    callback: Callback
  ) {
    hsTridentUtils.generateAReqParams(currentActivity, messageVersion, directoryServerId, cardNetwork, callback)
  }

  @ReactMethod
  fun receiveChallengeParamsFromRN(
    acsSignedContent: String,
    acsRefNumber: String,
    acsTransactionId: String,
    @Nullable threeDSRequestorAppURL: String?,
    threeDSServerTransId: String,
    callback: Callback
  ) {
    val challengeParameters = HsTridentConfigurator.getChallengeParams(
      acsRefNumber,
      acsSignedContent,
      acsTransactionId,
      threeDSRequestorAppURL,
      threeDSServerTransId,
    )
    hsTridentUtils.setChallengeParameter(challengeParameters, callback)
  }

  @ReactMethod
  fun generateChallenge(callback: Callback) {
    hsTridentUtils.generateChallenge(currentActivity, 5, callback)
  }
}
