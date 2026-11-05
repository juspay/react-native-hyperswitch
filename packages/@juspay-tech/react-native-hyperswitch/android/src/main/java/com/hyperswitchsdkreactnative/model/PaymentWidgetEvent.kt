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

  override fun getEventData() = Arguments.createMap().apply {
    putString("eventName", event.type)
    putMap(
      "payload",
      Arguments.makeNativeMap(event.payload)
    )
  }
}
