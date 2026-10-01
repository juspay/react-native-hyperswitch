package io.hyperswitch

import io.hyperswitch.utils.ConversionUtils
import org.json.JSONObject

interface PaymentEventListener {
  fun onPaymentEvent(event: PaymentEvent)
}

data class PaymentEvent(
  val type: String,
  val payload: Map<String, Any?>,
) {
  val data = JSONObject().apply {
    put("type", type)
    put("payload", ConversionUtils.convertMapToJson(payload))
  }
}
