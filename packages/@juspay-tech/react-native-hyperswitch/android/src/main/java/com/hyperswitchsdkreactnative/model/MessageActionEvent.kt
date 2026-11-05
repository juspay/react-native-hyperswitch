package com.hyperswitchsdkreactnative.model

import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.events.Event

/** A tapped payment method message action; separate from payment events. */
class MessageActionEvent(
  surfaceId: Int,
  viewId: Int,
  private val index: Int,
) : Event<MessageActionEvent>(surfaceId, viewId) {

  override fun getEventName() = "onMessageAction"
  /* Each tap must arrive, so taps are never merged. */
  override fun canCoalesce() = false

  override fun getEventData() = Arguments.createMap().apply {
    putInt("index", index)
  }
}
