package io.hyperswitch

import io.hyperswitch.utils.ConversionUtils
import org.json.JSONObject

interface PaymentEventListener {
  fun onPaymentEvent(event: PaymentEvent)
}

data class PaymentEvent(
  val eventName: String,
  val payload: Map<String, Any?>,
) {
  val data = JSONObject().apply {
    put("eventName", eventName)
    put("payload", ConversionUtils.convertMapToJson(payload))
  }
}
