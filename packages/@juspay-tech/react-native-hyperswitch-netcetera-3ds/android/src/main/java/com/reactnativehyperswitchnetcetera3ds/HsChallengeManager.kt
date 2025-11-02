package com.reactnativehyperswitchnetcetera3ds

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.netcetera.threeds.sdk.api.transaction.challenge.ChallengeStatusReceiver
import com.netcetera.threeds.sdk.api.transaction.challenge.events.CompletionEvent
import com.netcetera.threeds.sdk.api.transaction.challenge.events.ProtocolErrorEvent
import com.netcetera.threeds.sdk.api.transaction.challenge.events.RuntimeErrorEvent

class HsChallengeManager : ChallengeStatusReceiver {

  lateinit var postChallengeCallback: Callback;

  val map = Arguments.createMap()

  fun setPostHsChallengeCallback(callback: Callback) {
    this.postChallengeCallback = callback
  }

  override fun completed(completionEvent: CompletionEvent) {
    map.putString("status", "success")
    map.putString("message", "challenge completed successfully")
    postChallengeCallback.invoke(map)
  }

  override fun cancelled() {
    map.putString("status", "error")
    map.putString("message", "challenge cancelled by user")
    postChallengeCallback.invoke(map)
  }

  override fun timedout() {
    map.putString("status", "error")
    map.putString("message", "challenge timeout")
    postChallengeCallback.invoke(map)
  }

  override fun protocolError(protocolErrorEvent: ProtocolErrorEvent) {
    map.putString("status", "error")
    map.putString("message", protocolErrorEvent.errorMessage.toString())
    postChallengeCallback.invoke(map)
  }

  override fun runtimeError(runtimeErrorEvent: RuntimeErrorEvent) {
    map.putString("status", "error")
    map.putString("message", runtimeErrorEvent.errorMessage.toString())
    postChallengeCallback.invoke(map)
  }
}
