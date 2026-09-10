package io.hyperswitch.paymentsession

object GetWalletSessionCallBackManager {
    private var callback: ((WalletSessionHandler) -> Unit)? = null
    private var sdkAuthorization: String? = null

    fun setCallback(sdkAuthorization: String?, callback: (WalletSessionHandler) -> Unit) {
        this.sdkAuthorization = sdkAuthorization
        this.callback = callback
    }

    fun getSdkAuthorization(): String = sdkAuthorization ?: ""

    fun executeCallback(handler: WalletSessionHandler): Boolean {
        val current = callback ?: return false
        current(handler)
        return true
    }

    fun clearCallback() {
        callback = null
    }
}
