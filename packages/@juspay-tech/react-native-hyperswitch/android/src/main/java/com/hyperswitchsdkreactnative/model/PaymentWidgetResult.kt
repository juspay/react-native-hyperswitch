package com.hyperswitchsdkreactnative.model

import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.events.Event

class PaymentWidgetResult(
  surfaceId: Int,
  viewId: Int,
  private val result: String,
) : Event<PaymentWidgetEvent>(surfaceId, viewId) {

  override fun getEventName() = "onPaymentResult"

  override fun canCoalesce() = false

  override fun getEventData() = Arguments.createMap().apply {
    putString("eventName", "onPaymentResult")
    putString(
      "payload", result
    )
  }
}
