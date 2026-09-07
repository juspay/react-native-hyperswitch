package com.reactnativehyperswitchnetcetera3ds

import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

abstract class HyperswitchNetcetera3dsSpec internal constructor(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  abstract fun initialiseNetceteraSDK(
    apiKey: String,
    hsSDKEnvironment: String,
    callback: Callback
  )

  abstract fun generateAReqParams(
    messageVersion: String,
    directoryServerId: String,
    callback: Callback
  )

  abstract fun recieveChallengeParamsFromRN(
    acsSignedContent: String,
    acsRefNumber: String,
    acsTransactionId: String,
    threeDSRequestorAppURL: String?,
    threeDSServerTransId: String,
    callback: Callback
  )

  abstract fun generateChallenge(callback: Callback)
}
