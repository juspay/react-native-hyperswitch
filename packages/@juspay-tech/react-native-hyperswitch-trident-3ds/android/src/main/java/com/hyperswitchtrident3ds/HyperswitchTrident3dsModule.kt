package com.hyperswitchtrident3ds

import android.app.Application
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext

class HyperswitchTrident3dsModule(reactContext: ReactApplicationContext) :
  NativeHyperswitchTrident3dsSpec(reactContext) {
  private val hsTridentUtils = HsTridentUtils()
  private val applicationContext = reactApplicationContext.applicationContext as Application

  override fun getName(): String {
    return NAME
  }

  override fun initialiseSDK(
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

  override fun generateAReqParams(
    messageVersion: String,
    directoryServerId: String,
    cardNetwork: String,
    callback: Callback
  ) {
    hsTridentUtils.generateAReqParams(reactApplicationContext.currentActivity, messageVersion, directoryServerId, cardNetwork, callback)
  }

  override fun receiveChallengeParamsFromRN(
    acsSignedContent: String,
    acsRefNumber: String,
    acsTransactionId: String,
    threeDSRequestorAppURL: String?,
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

  override fun generateChallenge(callback: Callback) {
    hsTridentUtils.generateChallenge(reactApplicationContext.currentActivity, 5, callback)
  }

  companion object {
    const val NAME = "HyperswitchTrident3ds"
  }
}
