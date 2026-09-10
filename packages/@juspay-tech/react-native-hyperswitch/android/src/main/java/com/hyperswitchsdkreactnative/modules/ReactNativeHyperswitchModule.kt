package com.hyperswitchsdkreactnative.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType
import com.hyperswitchsdkreactnative.BuildConfig
import com.hyperswitchsdkreactnative.NativeHyperswitchModuleSpec
import io.hyperswitch.model.CustomEndpointConfiguration
import io.hyperswitch.model.HyperswitchConfiguration
import io.hyperswitch.model.HyperswitchEnvironment
import io.hyperswitch.model.OverrideEndpoints
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.wallet.IsReadyToPayRequest
import com.google.android.gms.wallet.Wallet
import com.google.android.gms.wallet.WalletConstants
import io.hyperswitch.paymentsession.GetPaymentSessionCallBackManager
import io.hyperswitch.paymentsession.GetWalletSessionCallBackManager
import io.hyperswitch.paymentsession.WalletSessionHandler
import io.hyperswitch.paymentsession.LaunchOptions
import io.hyperswitch.paymentsession.PMError
import io.hyperswitch.paymentsession.PaymentMethodType
import io.hyperswitch.paymentsession.PaymentSessionHandler
import io.hyperswitch.paymentsession.PaymentSessionReactLauncher
import io.hyperswitch.paymentsession.PaymentSheetCallbackManager
import io.hyperswitch.utils.ConversionUtils
import io.hyperswitch.utils.StandardResult
import io.hyperswitch.view.PaymentWidgetView
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlin.String
import kotlin.collections.orEmpty


class ReactNativeHyperswitchModule(reactContext: ReactApplicationContext) :
  NativeHyperswitchModuleSpec(reactContext) {

  private var paymentSessionReactLauncher: PaymentSessionReactLauncher? = null
  private var launchOptions: LaunchOptions? = null
  private var handler: PaymentSessionHandler? = null
  private var walletHandler: WalletSessionHandler? = null
  private var walletSdkAuthorization: String? = null

  private val uiManagerType = if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
    UIManagerType.FABRIC
  } else {
    UIManagerType.DEFAULT
  }

  override fun getName(): String {
    return NAME
  }

  override fun initialise(
    publishableKey: String?,
    platformPublishableKey: String?,
    profileId: String?,
    environment: String?,
    customEndpoints: ReadableMap?,
    promise: Promise?
  ) {
    val activity = reactApplicationContext.currentActivity
    if (publishableKey.isNullOrBlank()) {
      promise?.reject("INITIALIZATION_ERROR", "publishableKey is required")
      return
    }
    if (activity == null) {
      promise?.reject("INITIALIZATION_ERROR", "Current activity is null")
      return
    }

    activity.let {
      paymentSessionReactLauncher = PaymentSessionReactLauncher(activity)
      paymentSessionReactLauncher?.initializeReactNativeInstance()
    }
    val overrideEndpoints: OverrideEndpoints? = customEndpoints?.getMap("overrideEndpoints")?.let {
      val overrideEndpointsMap = customEndpoints.getMap("overrideEndpoints")
      OverrideEndpoints(
        customBackendEndpoint = overrideEndpointsMap?.getString("customBackendEndpoint"),
        customLoggingEndpoint = overrideEndpointsMap?.getString("customLoggingEndpoint"),
        customAssetEndpoint = overrideEndpointsMap?.getString("customAssetEndpoint"),
        customSDKConfigEndpoint = overrideEndpointsMap?.getString("customSDKConfigEndpoint"),
        customConfirmEndpoint = overrideEndpointsMap?.getString("customConfirmEndpoint"),
        customAirborneEndpoint = overrideEndpointsMap?.getString("customAirborneEndpoint"),
      )
    }
    val customConfig = CustomEndpointConfiguration(
      overrideEndpoints = overrideEndpoints,
      commonEndpoint = customEndpoints?.getString("commonEndpoint")

    )

    hyperswitchConfig = HyperswitchConfiguration(
      publishableKey = publishableKey,
      profileId = profileId,
      environment = environment?.let { HyperswitchEnvironment.valueOf(it) },
      customConfig = customConfig
    )
    activity.let {
      launchOptions = LaunchOptions(activity, BuildConfig.VERSION_NAME, hyperswitchConfig)
    }
    val handle = UUID.randomUUID().toString()
    promise?.resolve(handle)
  }

  override fun presentPaymentSheet(
    params: ReadableMap?,
    promise: Promise?
  ) {
    try {
      val props = mutableMapOf<String, Any?>().apply {
        putAll(params?.toHashMap().orEmpty())
        put("type", "payment")
      }
      val bundle = launchOptions?.getBundleWithHyperParams(props)
      bundle?.let {
        val isFragment = paymentSessionReactLauncher?.presentSheet(bundle)
        val resultCallback: (String) -> Unit = { it ->
          promise?.resolve(it)
        }
        PaymentSheetCallbackManager.setCallback(resultCallback, isFragment == true)
      }
    } catch (e: Exception) {
      val map = mutableMapOf<String, Any>().apply {
        put("code", "failed")
        put("message", "failed to open")
        put("reason", e.message.toString())
      }
      promise?.resolve(map)
    }
  }

  override fun getCustomerSavedPaymentMethods(
    params: ReadableMap?,
    promise: Promise
  ) {
    val props = mutableMapOf<String, Any?>().apply {
      putAll(params?.toHashMap().orEmpty())
      put("type", "payment")
    }

    val map: Map<String, Any?> = mapOf(
      "props" to props
    )
    val bundle = launchOptions?.toBundle(map)
    bundle?.let {
      val savedPaymentMethodCallback: (PaymentSessionHandler) -> Unit = { it ->
        handler = it
        promise.resolve(
          JSONObject().apply {
            put("code", "success")
            put("message", "Saved payment methods is initialized")
          }.toString()
        )
      }
      GetPaymentSessionCallBackManager.setCallback(
        params?.getMap("paymentSessionConfig")?.getString("sdkAuthorization"),
        savedPaymentMethodCallback
      )
      paymentSessionReactLauncher?.recreateReactContext(it)
    }

  }

  override fun getCustomerLastUsedPaymentMethodData(promise: Promise) {
    handler?.let {
      it.getCustomerLastUsedPaymentMethodData().fold(
        onSuccess = { data ->
          promise.resolve(ConversionUtils.convertMapToJson(data.toMap()).toString())
        },
        onFailure = { error ->
          val pmError = error as? PMError
          promise.resolve(
            StandardResult.Failed(
              code = pmError?.code ?: "UNKNOWN",
              message = pmError?.message ?: error.message ?: "Unknown error",
              error = Throwable(pmError?.message ?: error.message ?: "Unknown error")
            ).toJSONString()
          )
        }
      )
    }
  }

  override fun getCustomerDefaultSavedPaymentMethodData(promise: Promise) {
    handler?.let {
      it.getCustomerDefaultSavedPaymentMethodData().fold(
        onSuccess = { data ->
          promise.resolve(ConversionUtils.convertMapToJson(data.toMap()).toString())
        },
        onFailure = { error ->
          val pmError = error as? PMError
          promise.resolve(
            StandardResult.Failed(
              code = pmError?.code ?: "UNKNOWN",
              message = pmError?.message ?: error.message ?: "Unknown error",
              error = Throwable(pmError?.message ?: error.message ?: "Unknown error")
            ).toJSONString()
          )
        }
      )
    }
  }

  override fun getCustomerSavedPaymentMethodData(promise: Promise) {
    handler?.let {
      it.getCustomerSavedPaymentMethodData().fold(
        onSuccess = { data ->
          val jsonArray = JSONArray()
          data.forEach { item ->
            jsonArray.put(
              ConversionUtils.convertMapToJson(item.toMap())
            )
          }
          promise.resolve(jsonArray.toString())
        },
        onFailure = { error ->
          val pmError = error as? PMError
          promise.resolve(
            StandardResult.Failed(
              code = pmError?.code ?: "UNKNOWN",
              message = pmError?.message ?: error.message ?: "Unknown error",
              error = Throwable(pmError?.message ?: error.message ?: "Unknown error")
            ).toJSONString()
          )
        }
      )
    }
  }

  override fun confirmWithCustomerLastUsedPaymentMethod(reactTag: Double, promise: Promise?) {
    if (handler == null) {
      promise?.resolve(
        StandardResult.Failed(error = Throwable("Payment session handler not initialized."))
          .toJSONString()
      )
      return
    }

    val reactTag = reactTag.toInt()

    if (reactTag > 0) {
      val defaultData = handler?.getCustomerLastUsedPaymentMethodData()
      defaultData?.fold(
        onSuccess = { pm ->
          if (pm.requiresCvv && pm.paymentMethod == PaymentMethodType.CARD) {
            confirmViaWidgetView(reactTag, pm.paymentToken, pm.paymentMethodId, promise)
          } else {
            handler?.confirmWithCustomerLastUsedPaymentMethod(null) { result ->
              promise?.resolve(result.toJSONString())
            }
          }
        },
        onFailure = { error ->
          val pmError = error as? PMError
          promise?.resolve(
            StandardResult.Failed(
              code = pmError?.code ?: "UNKNOWN",
              message = pmError?.message ?: error.message ?: "Unknown error",
              error = Throwable(pmError?.message ?: error.message ?: "Unknown error")
            ).toJSONString()
          )
        }
      )
    } else {
      handler?.confirmWithCustomerLastUsedPaymentMethod(null) { result ->
        promise?.resolve(result.toJSONString())
      }
    }
  }

  override fun confirmWithCustomerDefaultPaymentMethod(reactTag: Double, promise: Promise?) {
    if (handler == null) {
      promise?.resolve(
        StandardResult.Failed(error = Throwable("Payment session handler not initialized."))
          .toJSONString()
      )
      return
    }

    val reactTag = reactTag.toInt()

    if (reactTag > 0) {
      val defaultData = handler?.getCustomerDefaultSavedPaymentMethodData()
      defaultData?.fold(
        onSuccess = { pm ->
          if (pm.requiresCvv && pm.paymentMethod == PaymentMethodType.CARD) {
            confirmViaWidgetView(reactTag, pm.paymentToken, pm.paymentMethodId, promise)
          } else {
            handler?.confirmWithCustomerDefaultPaymentMethod(null) { result ->
              promise?.resolve(result.toJSONString())
            }
          }
        },
        onFailure = { error ->
          val pmError = error as? PMError
          promise?.resolve(
            StandardResult.Failed(
              code = pmError?.code ?: "UNKNOWN",
              message = pmError?.message ?: error.message ?: "Unknown error",
              error = Throwable(pmError?.message ?: error.message ?: "Unknown error")
            ).toJSONString()
          )
        }
      )
    } else {
      handler?.confirmWithCustomerDefaultPaymentMethod(null) { result ->
        promise?.resolve(result.toJSONString())
      }
    }
  }

  override fun confirmWithCustomerPaymentToken(
    reactTag: Double,
    token: String?,
    promise: Promise?
  ) {
    if (handler == null) {
      promise?.resolve(
        StandardResult.Failed(
          code = "error",
          message = "UNKNOWN",
          error = Throwable("Payment session handler not initialized.")
        ).toJSONString()
      )
      return
    }
    if (token == null) {
      promise?.resolve(
        StandardResult.Failed(
          code = "error",
          message = "UNKNOWN",
          error = Throwable("Token cannot be null")
        ).toJSONString()
      )
      return
    } else {
      handler?.confirmWithCustomerPaymentToken(token, null) { result ->
        promise?.resolve(result.toJSONString())
      }
    }
  }

  override fun isGooglePaySupported(promise: Promise) {
    try {
      val available = GoogleApiAvailability.getInstance()
        .isGooglePlayServicesAvailable(reactApplicationContext)
      if (available != ConnectionResult.SUCCESS) {
        promise.resolve(false)
        return
      }

      val environment = when (hyperswitchConfig?.environment?.name) {
        "PROD" -> WalletConstants.ENVIRONMENT_PRODUCTION
        else -> WalletConstants.ENVIRONMENT_TEST
      }

      val paymentsClient = Wallet.getPaymentsClient(
        reactApplicationContext,
        Wallet.WalletOptions.Builder().setEnvironment(environment).build()
      )

      val request = IsReadyToPayRequest.fromJson(IS_READY_TO_PAY_REQUEST)

      paymentsClient.isReadyToPay(request).addOnCompleteListener { task ->
        promise.resolve(runCatching { task.getResult(ApiException::class.java) }.getOrDefault(false))
      }
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  override fun isApplePaySupported(promise: Promise) {
    promise.resolve(false)
  }

  override fun getWalletSession(params: ReadableMap?, promise: Promise) {
    val sdkAuthorization =
      params?.getMap("paymentSessionConfig")?.getString("sdkAuthorization")

    if (sdkAuthorization.isNullOrEmpty()) {
      promise.resolve(
        StandardResult.Failed(
          code = "INVALID_ARGUMENT",
          message = "paymentSessionConfig.sdkAuthorization is required",
          error = Throwable("paymentSessionConfig.sdkAuthorization is required")
        ).toJSONString()
      )
      return
    }

    // Reuse only while the intent is unchanged. A new sdkAuthorization means
    // updateIntent replaced the intent, so the handler is rebuilt against it.
    if (walletHandler != null && walletSdkAuthorization == sdkAuthorization) {
      promise.resolve(
        JSONObject().apply {
          put("code", "success")
          put("message", "Wallet session already initialized")
        }.toString()
      )
      return
    }

    walletHandler = null
    walletSdkAuthorization = sdkAuthorization

    val props = mutableMapOf<String, Any?>().apply {
      putAll(params?.toHashMap().orEmpty())
      put("type", "walletWidget")
    }

    val map: Map<String, Any?> = mapOf("props" to props)
    val bundle = launchOptions?.toBundle(map)

    if (bundle == null) {
      promise.resolve(
        StandardResult.Failed(
          code = "NOT_INITIALISED",
          message = "SDK is not initialised",
          error = Throwable("SDK is not initialised")
        ).toJSONString()
      )
      return
    }

    var resolved = false
    val walletSessionCallback: (WalletSessionHandler) -> Unit = {
      walletHandler = it
      if (!resolved) {
        resolved = true
        promise.resolve(
          JSONObject().apply {
            put("code", "success")
            put("message", "Wallet session is initialized")
          }.toString()
        )
      }
    }

    GetWalletSessionCallBackManager.setCallback(sdkAuthorization, walletSessionCallback)
    paymentSessionReactLauncher?.recreateReactContext(bundle)
  }

  override fun isWalletEligible(wallet: String, promise: Promise) {
    val current = walletHandler
    if (current == null) {
      promise.resolve(false)
      return
    }
    promise.resolve(current.isWalletEligible(wallet))
  }

  override fun launchWallet(wallet: String, promise: Promise) {
    val current = walletHandler
    if (current == null) {
      promise.resolve(
        StandardResult.Failed(
          code = "NO_HANDLER",
          message = "Wallet session handler not initialized.",
          error = Throwable("Wallet session handler not initialized.")
        ).toJSONString()
      )
      return
    }
    current.launchWallet(wallet) { result ->
      promise.resolve(result.toJSONString())
    }
  }

//  override fun updateIntent(sdkAuthorization: String?, promise: Promise?) {
//
//  }


  private fun confirmViaWidgetView(
    reactTag: Int,
    paymentToken: String,
    paymentMethodId: String,
    promise: Promise?
  ) {
    UiThreadUtil.runOnUiThread {
      val uiManagerModule =
        UIManagerHelper.getUIManager(
          reactApplicationContext,
          uiManagerType
        )
      try {
        val view = uiManagerModule?.resolveView(reactTag)
        if (view is PaymentWidgetView) {
          view.confirmCvcPayment(paymentToken, paymentMethodId) { result: String ->
            UiThreadUtil.runOnUiThread {
              try {
                promise?.resolve(result)
              } catch (e: Exception) {
                promise?.resolve(
                  StandardResult.Failed(
                    code = "UNKNOWN_ERROR",
                    error = Throwable("${e.message}")
                  ).toJSONString()
                )
              }
            }
          }
        } else {
          promise?.resolve(
            StandardResult.Failed(
              code = "INVALID_VIEW",
              error = Throwable("View at reactTag $reactTag is not a CvcWidget")
            ).toJSONString()
          )
        }
      } catch (e: Exception) {
        promise?.resolve(
          StandardResult.Failed(
            code = "NO_WIDGET",
            error = Throwable("CvcWidget not found at reactTag $reactTag: ${e.message}")
          ).toJSONString()
        )
      }
    }
  }

  companion object {
    const val NAME = "NativeHyperswitchModule"
    private const val IS_READY_TO_PAY_REQUEST =
      """{"apiVersion":2,"apiVersionMinor":0,"allowedPaymentMethods":[{"type":"CARD","parameters":{"allowedAuthMethods":["PAN_ONLY","CRYPTOGRAM_3DS"],"allowedCardNetworks":["AMEX","DISCOVER","JCB","MASTERCARD","VISA"]}}]}"""
    private var hyperswitchConfig: HyperswitchConfiguration? = null
  }
}
