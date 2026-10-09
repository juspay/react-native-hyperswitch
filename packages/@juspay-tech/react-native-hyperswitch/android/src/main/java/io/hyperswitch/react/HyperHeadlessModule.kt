package io.hyperswitch.react

import android.util.Log
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.hyperswitchsdkreactnative.NativeHyperHeadlessSpec
import io.hyperswitch.paymentsession.ExitHeadlessCallBackManager
import io.hyperswitch.paymentsession.GetWalletSessionCallBackManager
import io.hyperswitch.paymentsession.HeadlessAttempt
import io.hyperswitch.paymentsession.WalletSessionHandlerImpl

class HyperHeadlessModule internal constructor(private val rct: ReactApplicationContext) :
    NativeHyperHeadlessSpec(rct) {
    override fun getName(): String = NAME

    @ReactMethod
    override  fun getPaymentSession(
        rootTag: Double,
        paymentIntentData: ReadableMap,
        defaultPaymentMethod: ReadableMap,
        savedPaymentMethods: ReadableArray,
        callback: Callback
    ) {
        SurfaceOwners.resolve(rct, rootTag.toInt()) { owner ->
            when (owner) {
                is HeadlessAttempt ->
                    owner.onPaymentSession(paymentIntentData, defaultPaymentMethod, savedPaymentMethods, callback)
                else -> Log.w(TAG, "getPaymentSession: no headless owner for rootTag=$rootTag")
            }
        }
    }

    @ReactMethod
    override fun getWalletSession(
        rootTag: Double,
        wallets: ReadableArray,
        callback: Callback
    ) {
        val handler = WalletSessionHandlerImpl(
            walletsData = wallets,
            jsCallback = callback,
        )
        GetWalletSessionCallBackManager.executeCallback(handler)
    }

    @ReactMethod
    override fun exitHeadless(rootTag: Double, status: ReadableMap) {
      try {
        val json = status.toExitResultJson()
        // Saved-methods surfaces and CVC widgets answer through their own root;
        // the wallet session still answers through the callback manager.
        SurfaceOwners.resolve(rct, rootTag.toInt()) { owner ->
          when (owner) {
            is HeadlessAttempt -> owner.onExit(parsePaymentResult(json))
            is HyperFragment -> owner.notifyResult(CallbackType.CONFIRM_CVC_ACTION, json)
            else -> ExitHeadlessCallBackManager.executeCallback(rootTag.toInt(), json)
          }
        }
      }catch (_: Exception){
      }
    }

  companion object {
    const val NAME = "HyperHeadless"
    private const val TAG = "HyperHeadlessModule"
  }
}
