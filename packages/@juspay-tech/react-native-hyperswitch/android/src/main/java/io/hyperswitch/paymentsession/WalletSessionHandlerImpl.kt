package io.hyperswitch.paymentsession

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReadableArray
import io.hyperswitch.paymentsheet.PaymentResult

internal class WalletSessionHandlerImpl(
    private val walletsData: ReadableArray,
    private val jsCallback: Callback,
) : WalletSessionHandler {

    override fun isWalletEligible(wallet: String): Boolean {
        for (i in 0 until walletsData.size()) {
            val map = walletsData.getMap(i) ?: continue
            if (map.getString("wallet") == wallet) {
                return map.getBoolean("isEligible")
            }
        }
        return false
    }

    override fun getEligibleWallets(): List<String> = buildList {
        for (i in 0 until walletsData.size()) {
            val map = walletsData.getMap(i) ?: continue
            val name = map.getString("wallet") ?: continue
            if (map.getBoolean("isEligible")) add(name)
        }
    }

    override fun launchWallet(wallet: String, resultHandler: (PaymentResult) -> Unit) {
        if (!isWalletEligible(wallet)) {
            resultHandler(
                PaymentResult.Failed(
                    Throwable("$wallet is not eligible for this payment")
                )
            )
            return
        }

        try {
            val resultToPaymentResultHandler = { result: String ->
                resultHandler(ExitHeadlessCallBackManager.parseResult(result))
            }
            val registered =
                ExitHeadlessCallBackManager.tryRegisterCallback(-1, resultToPaymentResultHandler)
            if (!registered) {
                resultHandler(
                    PaymentResult.Failed(
                        Throwable("A payment is already in progress for this handler")
                    )
                )
                return
            }
            jsCallback.invoke(Arguments.createMap().apply {
                putString("wallet", wallet)
            })
        } catch (ex: Exception) {
            ExitHeadlessCallBackManager.clearCallback(-1)
            resultHandler(PaymentResult.Failed(Throwable(ex.message ?: "Not Initialised")))
        }
    }
}
