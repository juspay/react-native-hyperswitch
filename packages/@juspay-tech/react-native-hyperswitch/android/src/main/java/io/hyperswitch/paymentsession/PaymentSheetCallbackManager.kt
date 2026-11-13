package io.hyperswitch.paymentsession

import java.util.concurrent.atomic.AtomicReference

typealias Callback = (String) -> Unit

object PaymentSheetCallbackManager {
    private val callback = AtomicReference<Callback?>(null)
    private var isFragment: Boolean = true

    /* Message action of the Activity-fallback sheet, which has no fragment to hold one. */
    @Volatile
    var messageAction: MessageActionHandler? = null

    fun setCallback(newCallback: Callback, newIsFragment: Boolean = true) {
        callback.set(newCallback)
        isFragment = newIsFragment
    }

    fun getCallback(): Callback? {
        return callback.get()
    }

    fun executeCallback(data: String): Boolean {
//        val jsonObject = JSONObject(data)
//        val result = when (val status = jsonObject.getString("status")) {
//            "cancelled" -> PaymentResult.Canceled(status)
//            "failed", "requires_payment_method" -> {
//                val message = jsonObject.getString("message")
//                val throwable = Throwable(message.ifEmpty { status })
//                throwable.initCause(Throwable(jsonObject.getString("code")))
//                PaymentResult.Failed(throwable)
//            }
//
//            else -> PaymentResult.Completed(status)
//        }

        messageAction = null
        // Atomically get and clear callback to prevent double-invocation
        val currentCallback = callback.getAndSet(null)
        currentCallback?.invoke(data) ?: println("No callback set")
        return isFragment
    }
}
