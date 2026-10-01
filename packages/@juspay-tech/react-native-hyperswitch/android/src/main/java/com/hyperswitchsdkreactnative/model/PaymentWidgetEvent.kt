package com.hyperswitchsdkreactnative.model

import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.events.Event
import io.hyperswitch.PaymentEvent

class PaymentWidgetEvent(
  surfaceId: Int,
  viewId: Int,
  private val event: PaymentEvent,
) : Event<PaymentWidgetEvent>(surfaceId, viewId) {

  override fun getEventName() = "onPaymentEvent"

  // Events arrive back to back (e.g. ready + paymentMethodChange); none may merge.
  override fun canCoalesce() = false

  override fun getEventData() = Arguments.createMap().apply {
    putString("eventName", event.type)
    // Codegen types the payload as a string on every platform; JS parses it.
    putString("payload", event.data.optJSONObject("payload")?.toString() ?: "{}")
  }
}
