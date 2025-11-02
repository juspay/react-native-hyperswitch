package com.hyperswitchtrident3ds

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import `in`.juspay.trident.data.ChallengeStatusReceiver
import `in`.juspay.trident.data.CompletionEvent
import `in`.juspay.trident.data.ProtocolErrorEvent
import `in`.juspay.trident.data.RuntimeErrorEvent

class HsChallengeManager(private val rnCallback: Callback) : ChallengeStatusReceiver {
  private var callbackInvoked = false

  private fun invokeCallbackOnce(map: com.facebook.react.bridge.WritableMap) {
    if (!callbackInvoked) {
      callbackInvoked = true
      rnCallback.invoke(map)
    }
  }

  override fun completed(completionEvent: CompletionEvent) {
    val map = Arguments.createMap()
    map.putString("status", "completed")
    map.putString("message", "challenge completed successfully")
    invokeCallbackOnce(map)
  }

  override fun cancelled() {
    val map = Arguments.createMap()
    map.putString("status", "error")
    map.putString("message", "challenge cancelled by user")
    invokeCallbackOnce(map)
  }

  override fun timedout() {
    val map = Arguments.createMap()
    map.putString("status", "error")
    map.putString("message", "challenge timeout")
    invokeCallbackOnce(map)
  }

  override fun protocolError(protocolErrorEvent: ProtocolErrorEvent) {
    val map = Arguments.createMap()
    map.putString("status", "error")
    map.putString("message", protocolErrorEvent.errorMessage.errorDescription.toString())
    invokeCallbackOnce(map)
  }

  override fun runtimeError(runtimeErrorEvent: RuntimeErrorEvent) {
    val map = Arguments.createMap()
    map.putString("status", "error")
    map.putString("message", runtimeErrorEvent.errorMessage.toString())
    invokeCallbackOnce(map)
  }
}
