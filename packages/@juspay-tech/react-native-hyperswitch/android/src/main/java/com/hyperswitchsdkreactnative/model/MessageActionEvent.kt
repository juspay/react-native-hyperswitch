package com.hyperswitchsdkreactnative.model

import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.events.Event

/** A tapped payment method message action; separate from payment events. */
class MessageActionEvent(
  surfaceId: Int,
  viewId: Int,
  private val paymentMethod: String,
  private val paymentMethodType: String,
  private val index: Int,
  private val text: String,
) : Event<MessageActionEvent>(surfaceId, viewId) {

  override fun getEventName() = "onMessageAction"
  /* Each tap must arrive, so taps are never merged. */
  override fun canCoalesce() = false

  override fun getEventData() = data(paymentMethod, paymentMethodType, index, text)

  companion object {
    /* The payload shared by the widget event and the sheet emitter. */
    fun data(paymentMethod: String, paymentMethodType: String, index: Int, text: String) = Arguments.createMap().apply {
      putString("paymentMethod", paymentMethod)
      putString("paymentMethodType", paymentMethodType)
      putInt("index", index)
      putString("text", text)
    }
  }
}
