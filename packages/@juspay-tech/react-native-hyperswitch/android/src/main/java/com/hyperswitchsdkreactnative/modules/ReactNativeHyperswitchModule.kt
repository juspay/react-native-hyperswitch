package com.hyperswitchsdkreactnative.modules

import android.app.Activity
import android.app.Application
import android.os.Bundle
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
import io.hyperswitch.model.PaymentSessionConfiguration
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.wallet.IsReadyToPayRequest
import com.google.android.gms.wallet.Wallet
import com.google.android.gms.wallet.WalletConstants
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
import java.util.concurrent.ConcurrentHashMap
import kotlin.String
import kotlin.collections.orEmpty


class ReactNativeHyperswitchModule(reactContext: ReactApplicationContext) :
  NativeHyperswitchModuleSpec(reactContext) {

  private var paymentSessionReactLauncher: PaymentSessionReactLauncher? = null

  /** client-core's HyperswitchInstance.activity: the Activity every session of this instance runs in. */
  private var instanceActivity: Activity? = null

  /**
   * client-core's PaymentSession: every TS initPaymentSession()/elements() gets its own launcher
   * (its DefaultPaymentSessionLauncher), keyed by the session's tag, which TS passes back with
   * every session call. A session closed with its Activity stays here, as a closed client-core
   * session object does, and answers SESSION_CLOSED; all of them run in [instanceActivity].
   */
  private val sessions = ConcurrentHashMap<Int, PaymentSessionReactLauncher>()

  /** The session a call belongs to; calls without one keep using the launcher from [initialise]. */
  internal fun session(sessionTag: Int?): PaymentSessionReactLauncher? = sessionTag?.let { sessions[it] }

  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  /** An updateIntent between its two bridge calls; client-core's Elements.updateIntent suspends across them instead. */
  private class PendingUpdateIntent {
    var onAuthorization: ((String) -> Unit)? = null
    var result: Result<String>? = null
    var completion: Promise? = null
  }

  /** Main thread. One per session, as client-core's Elements.updateIntent is per Elements. */
  private val pendingUpdateIntents = HashMap<Int, PendingUpdateIntent>()

  /** The session whose saved methods produced [handler]; its CVC confirms run under it. */
  private var handlerSession: PaymentSessionReactLauncher? = null
  private var launchOptions: LaunchOptions? = null
  private var handler: PaymentSessionHandler? = null
  private var walletHandler: WalletSessionHandler? = null
  private var walletSdkAuthorization: String? = null

  private val uiManagerType = if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
    UIManagerType.FABRIC
  } else {
    UIManagerType.DEFAULT
  }

  override fun invalidate() {
    moduleScope.cancel()
    super.invalidate()
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
    instanceActivity = activity
    paymentSessionReactLauncher = PaymentSessionReactLauncher(activity, hyperswitchConfig).also {
      it.initializeReactNativeInstance()
    }
    val handle = UUID.randomUUID().toString()
    promise?.resolve(handle)
  }

  override fun presentPaymentSheet(
    params: ReadableMap?,
    promise: Promise?
  ) {
    try {
      val launcher = session(params.sessionTag()) ?: paymentSessionReactLauncher
      val props = mutableMapOf<String, Any?>().apply {
        putAll(params?.toHashMap().orEmpty())
        remove(SESSION_TAG)
        put("type", "payment")
      }
      val bundle = launchOptions?.getBundleWithHyperParams(props)
      bundle?.let {
        val isFragment = launcher?.presentSheet(bundle)
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

  /**
   * client-core's DefaultPaymentSessionLauncher.initPaymentSession, then HyperswitchInstance's
   * awaitReady: a new session whose prefetch surface runs under these credentials, in the
   * instance's Activity. Resolves the session's tag, which TS passes back with every call for
   * this session; rejects where client-core's initPaymentSession would throw.
   */
  override fun initPaymentSession(params: ReadableMap?, promise: Promise) {
    val activity = instanceActivity
    if (activity == null) {
      promise.reject("INITIALIZATION_ERROR", "Hyperswitch.init has not completed")
      return
    }
    val sdkAuthorization = params?.getMap("paymentSessionConfig")?.getString("sdkAuthorization") ?: ""
    val launcher = PaymentSessionReactLauncher(activity, hyperswitchConfig).also {
      it.initializeReactNativeInstance()
    }
    launcher.sessionConfig = PaymentSessionConfiguration(sdkAuthorization)
    launcher.prefetch()
    moduleScope.launch {
      try {
        launcher.awaitReady()
      } catch (e: Exception) {
        // client-core's initPaymentSession throws here; across the bridge that is a rejection.
        promise.reject("INIT_PAYMENT_SESSION_FAILED", e)
        return@launch
      }
      val sessionTag = launcher.sessionTag
      if (sessionTag == null) {
        promise.reject("INIT_PAYMENT_SESSION_FAILED", "The payment session has no prefetch surface")
        return@launch
      }
      sessions[sessionTag] = launcher
      closeWithActivity(activity, launcher)
      promise.resolve(sessionTag)
    }
  }

  /**
   * First half of client-core's Elements.updateIntent: starts the session's updateIntent and
   * resolves once the merchant's authorization is needed, or with the failure that ended it.
   */
  override fun updateIntentInit(sessionTag: Double, promise: Promise) {
    val tag = sessionTag.toInt()
    val launcher = session(tag)
    if (launcher == null) {
      promise.resolve(updateIntentResultJson(Result.failure(
        Throwable("initPaymentSession has not been called").apply { initCause(Throwable("NOT_INITIALISED")) }
      )))
      return
    }
    UiThreadUtil.runOnUiThread {
      val pending = PendingUpdateIntent()
      var initAnswered = false
      launcher.updateIntent(
        authorizationProvider = { onAuthorization ->
          pending.onAuthorization = onAuthorization
          pendingUpdateIntents[tag] = pending
          initAnswered = true
          promise.resolve(StandardResult.Success().toJSONString())
        },
        onResult = { result ->
          if (!initAnswered) {
            initAnswered = true
            promise.resolve(updateIntentResultJson(result))
          } else {
            val completion = pending.completion
            if (completion != null) {
              pending.completion = null
              completion.resolve(updateIntentResultJson(result))
            } else {
              pending.result = result
            }
          }
        }
      )
    }
  }

  /**
   * Second half: hands the merchant's new authorization ("" when it could not be produced, as
   * client-core does) to the session and resolves with the updateIntent result.
   */
  override fun updateIntentComplete(sessionTag: Double, sdkAuthorization: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      val pending = pendingUpdateIntents.remove(sessionTag.toInt())
      if (pending == null) {
        promise.resolve(updateIntentResultJson(Result.failure(
          Throwable("No updateIntent is in progress").apply { initCause(Throwable("UNKNOWN_ERROR")) }
        )))
        return@runOnUiThread
      }
      val result = pending.result
      if (result != null) {
        promise.resolve(updateIntentResultJson(result))
        return@runOnUiThread
      }
      pending.completion = promise
      pending.onAuthorization?.invoke(sdkAuthorization)
    }
  }

  private fun updateIntentResultJson(result: Result<String>): String =
    result.fold(
      onSuccess = { StandardResult.Success().toJSONString() },
      onFailure = { StandardResult.Failed(code = it.cause?.message, error = it).toJSONString() },
    )

  /**
   * client-core's DefaultPaymentSessionLauncher.closeWithActivity: the Application reports the
   * destruction of the Activity the session was created for, and the session closes with it.
   */
  private fun closeWithActivity(activity: Activity, launcher: PaymentSessionReactLauncher) {
    val application = activity.application ?: return
    if (activity.isDestroyed) {
      launcher.close()
      return
    }
    application.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
      override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
      override fun onActivityStarted(activity: Activity) {}
      override fun onActivityResumed(activity: Activity) {}
      override fun onActivityPaused(activity: Activity) {}
      override fun onActivityStopped(activity: Activity) {}
      override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
      override fun onActivityDestroyed(destroyed: Activity) {
        if (destroyed !== activity) return
        application.unregisterActivityLifecycleCallbacks(this)
        launcher.close()
      }
    })
  }

  override fun getCustomerSavedPaymentMethods(
    params: ReadableMap?,
    promise: Promise
  ) {
    val launcher = session(params.sessionTag()) ?: paymentSessionReactLauncher
    val props = mutableMapOf<String, Any?>().apply {
      putAll(params?.toHashMap().orEmpty())
      remove(SESSION_TAG)
      put("type", "headless")
    }
    // With sdkParams, as client-core's LaunchOptions.getBundle builds it; the session tag goes there.
    val bundle = launchOptions?.getBundleWithHyperParams(props)
    bundle?.let {
      val savedPaymentMethodCallback: (PaymentSessionHandler) -> Unit = { it ->
        handler = it
        handlerSession = launcher
        promise.resolve(
          JSONObject().apply {
            put("code", "success")
            put("message", "Saved payment methods is initialized")
          }.toString()
        )
      }
      launcher?.startSavedPaymentMethods(it, savedPaymentMethodCallback)
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
            confirmViaWidgetView(reactTag, pm.paymentToken, pm.billing, promise)
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
            confirmViaWidgetView(reactTag, pm.paymentToken, pm.billing, promise)
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
    billing: String?,
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
          // client-core's PaymentSessionHandlerImpl CVC-widget confirm: refused while the session
          // updates its intent, otherwise run with the session's current credentials.
          val session = handlerSession
          if (session?.isUpdatingIntent == true) {
            promise?.resolve(
              StandardResult.Failed(
                code = "UPDATE_IN_PROGRESS",
                error = Throwable("An intent update is in progress; confirm after it completes").apply {
                  initCause(Throwable("UPDATE_IN_PROGRESS"))
                }
              ).toJSONString()
            )
            return@runOnUiThread
          }
          session?.sessionConfig?.let { view.setSdkAuthorization(it.sdkAuthorization) }
          view.confirmCvcPayment(paymentToken, billing) { result: String ->
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
              code = "WIDGET_UNAVAILABLE",
              error = Throwable("View can't be cast as CVCWidget").apply {
                initCause(Throwable("WIDGET_UNAVAILABLE"))
              }
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

  private fun ReadableMap?.sessionTag(): Int? =
    if (this != null && hasKey(SESSION_TAG) && !isNull(SESSION_TAG)) getInt(SESSION_TAG) else null

  companion object {
    const val NAME = "NativeHyperswitchModule"
    private const val SESSION_TAG = "sessionTag"
    private const val IS_READY_TO_PAY_REQUEST =
      """{"apiVersion":2,"apiVersionMinor":0,"allowedPaymentMethods":[{"type":"CARD","parameters":{"allowedAuthMethods":["PAN_ONLY","CRYPTOGRAM_3DS"],"allowedCardNetworks":["AMEX","DISCOVER","JCB","MASTERCARD","VISA"]}}]}"""
    private var hyperswitchConfig: HyperswitchConfiguration? = null
  }
}
