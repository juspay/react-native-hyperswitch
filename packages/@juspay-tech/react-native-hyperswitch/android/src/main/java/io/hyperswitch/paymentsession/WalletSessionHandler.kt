package io.hyperswitch.paymentsession

import io.hyperswitch.paymentsheet.PaymentResult

interface WalletSessionHandler {
    fun isWalletEligible(wallet: String): Boolean
    fun getEligibleWallets(): List<String>
    fun launchWallet(wallet: String, resultHandler: (PaymentResult) -> Unit)
}
