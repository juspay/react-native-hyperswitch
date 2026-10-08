package com.hyperswitchsdkreactnative.modules

import android.app.Activity
import android.content.pm.ActivityInfo
import android.content.res.Configuration
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
import io.hyperswitch.logs.EventName
import io.hyperswitch.logs.HSLog
import io.hyperswitch.logs.HyperLogManager
import io.hyperswitch.logs.LogCategory
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
import java.lang.ref.WeakReference
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
  // The Activity that paymentSessionReactLauncher and launchOptions were built for, and a copy of
  // its configuration (kept so the rebind log can say what changed even after it is collected).
  private var boundActivity: WeakReference<Activity>? = null
  private var boundConfiguration: Configuration? = null
  // HyperLogManager keeps logs in memory until it is initialised, so only log once it is.
  private var loggingEnabled = false
  // The Activity whose launcher built walletHandler.
  private var walletHandlerActivity: WeakReference<Activity>? = null

  private val uiManagerType = if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
    UIManagerType.FABRIC
  } else {
    UIManagerType.DEFAULT
  }

  override fun getName(): String {
    return NAME
  }

  /**
   * Accepts the same spellings as the iOS module ("PROD"/"PRODUCTION", "SANDBOX", "INTEG",
   * case-insensitive). Anything else yields null (SDK picks the environment from the
   * publishable key) instead of throwing from `valueOf`.
   */
  private fun parseEnvironment(value: String?): HyperswitchEnvironment? =
    when (value?.trim()?.uppercase()) {
      "PROD", "PRODUCTION" -> HyperswitchEnvironment.PROD
      "SANDBOX" -> HyperswitchEnvironment.SANDBOX
      "INTEG" -> HyperswitchEnvironment.INTEG
      else -> HyperswitchEnvironment.PROD
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
      environment = parseEnvironment(environment),
      customConfig = customConfig
    )
    // Without this, logs added through HyperLogManager are kept in memory and never sent.
    val loggingEndpoint =
      getLoggingEndpoint(publishableKey, overrideEndpoints, customConfig.commonEndpoint)
    loggingEnabled = loggingEndpoint != null
    loggingEndpoint?.let { HyperLogManager.initialise(publishableKey, it) }
    activity.let {
      launchOptions = LaunchOptions(activity, BuildConfig.VERSION_NAME, hyperswitchConfig)
    }
    boundActivity = WeakReference(activity)
    boundConfiguration = Configuration(activity.resources.configuration)
    sendLog(
      "debug",
      "SDK initialised (environment=${hyperswitchConfig?.environment}, " +
        "activity=${activity.javaClass.simpleName})"
    )
    val handle = UUID.randomUUID().toString()
    promise?.resolve(handle)
  }

  /**
   * [initialise] binds the launcher to the Activity that is current at that moment. If that
   * Activity is replaced later in the same process (configuration change, recreate(), "Don't keep
   * activities"), the sheet would be committed to the destroyed Activity's FragmentManager, which
   * silently drops it, and presentPaymentSheet would never settle. Rebuild both for the current
   * Activity, as [initialise] does.
   */
  private fun rebindToCurrentActivity(trigger: String) {
    val current = reactApplicationContext.currentActivity ?: return
    if (paymentSessionReactLauncher == null || boundActivity?.get() === current) return
    val details = "trigger=$trigger, reason=${replacementReason(boundActivity?.get())}, " +
      "configChanged=${configurationChanges(boundConfiguration, current.resources.configuration)}"
    try {
      val launcher = PaymentSessionReactLauncher(current)
      launcher.initializeReactNativeInstance()
      paymentSessionReactLauncher = launcher
      launchOptions = LaunchOptions(current, BuildConfig.VERSION_NAME, hyperswitchConfig)
      boundActivity = WeakReference(current)
      boundConfiguration = Configuration(current.resources.configuration)
      sendLog("warning", "Activity changed since initialise; rebound payment launcher ($details)")
    } catch (e: Exception) {
      sendLog("error", "Could not rebind payment launcher ($details): ${e.message}")
    }
  }

  /** Why the previously bound Activity is no longer the current one. */
  private fun replacementReason(previous: Activity?): String = when {
    previous == null -> "unknown, previous Activity already collected"
    previous.isChangingConfigurations -> "configuration change or recreate()"
    previous.isFinishing -> "previous Activity finished"
    previous.isDestroyed -> "previous Activity destroyed by the system"
    else -> "another Activity is in front"
  }

  /** Names of the configuration fields that differ, e.g. "fontScale,locale"; "none" for recreate(). */
  private fun configurationChanges(previous: Configuration?, current: Configuration): String {
    previous ?: return "unknown"
    val diff = previous.diff(current)
    return CONFIG_NAMES.filter { (bit, _) -> diff and bit != 0 }.joinToString(",") { it.second }
      .ifEmpty { if (diff == 0) "none" else "0x" + Integer.toHexString(diff) }
  }

  /**
   * Sends a log to the SDK logging endpoint through HyperLogManager. Logger 1.0.0 has no generic
   * event, so these use CRASH_EVENT; logType (debug/warning/error) and value say what happened.
   * Never throws, so logging cannot break a payment flow. addLog runs on the UI thread because
   * logger 1.0.0 keeps an unsynchronised batch that its debouncer reads on the main looper.
   */
  private fun sendLog(logType: String, value: String) {
    if (!loggingEnabled) return
    val log = runCatching {
      HSLog.LogBuilder()
        .logType(logType)
        .category(LogCategory.API)
        .eventName(EventName.CRASH_EVENT)
        .value(value)
        .build()
    }.getOrNull() ?: return
    UiThreadUtil.runOnUiThread { runCatching { HyperLogManager.addLog(log) } }
  }

  /**
   * Mirrors the JS logger (GlobalHooks.getLoggingUrl): endpoints come from overrideEndpoints when
   * given, otherwise from commonEndpoint. A custom backend without a logging endpoint, or an empty
   * logging endpoint, turns logging off (null). With neither, the default host is used, picked
   * like GlobalVars.checkEnv: sandbox for pk_snd_ keys, production otherwise.
   */
  private fun getLoggingEndpoint(
    publishableKey: String,
    overrideEndpoints: OverrideEndpoints?,
    commonEndpoint: String?
  ): String? {
    val backend: String?
    val logs: String?
    if (overrideEndpoints != null) {
      backend = overrideEndpoints.customBackendEndpoint
      logs = overrideEndpoints.customLoggingEndpoint
    } else {
      backend = commonEndpoint?.let { "$it$BACKEND_PATH" }
      logs = commonEndpoint?.let { "$it$LOGS_PATH" }
    }
    return when {
      logs != null -> logs.ifEmpty { null }
      backend != null -> null
      else -> (if (publishableKey.startsWith("pk_snd_")) SANDBOX_HOST else PROD_HOST) + LOGS_PATH
    }
  }

  override fun presentPaymentSheet(
    params: ReadableMap?,
    promise: Promise?
  ) {
    try {
      rebindToCurrentActivity("presentPaymentSheet")
      sendLog(
        "debug",
        "presentPaymentSheet called (sdkInitialised=${launchOptions != null}, " +
          "activity=${reactApplicationContext.currentActivity?.javaClass?.simpleName})"
      )
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
    rebindToCurrentActivity("getCustomerSavedPaymentMethods")
    val props = mutableMapOf<String, Any?>().apply {
      putAll(params?.toHashMap().orEmpty())
      put("type", "payment")
    }

    // sdkParams carries appId, which the headless confirm needs to send a return_url.
    val bundle = launchOptions?.getBundleWithHyperParams(props)
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

    rebindToCurrentActivity("getWalletSession")

    // Reuse only while the intent and the Activity are unchanged. A new sdkAuthorization means
    // updateIntent replaced the intent; a new Activity means the handler's headless task resumed
    // the SDK host with the old one. Either way the handler is rebuilt.
    if (
      walletHandler != null &&
      walletSdkAuthorization == sdkAuthorization &&
      walletHandlerActivity?.get() === boundActivity?.get()
    ) {
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

    // sdkParams carries appId, which the headless confirm needs to send a return_url.
    val bundle = launchOptions?.getBundleWithHyperParams(props)

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
    val handlerActivity = boundActivity
    val walletSessionCallback: (WalletSessionHandler) -> Unit = {
      walletHandler = it
      walletHandlerActivity = handlerActivity
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
    private const val PROD_HOST = "https://live.hyperswitch.io"
    private const val SANDBOX_HOST = "https://app.hyperswitch.io"
    private const val BACKEND_PATH = "/api"
    private val CONFIG_NAMES = listOf(
      ActivityInfo.CONFIG_FONT_SCALE to "fontScale",
      ActivityInfo.CONFIG_LOCALE to "locale",
      ActivityInfo.CONFIG_LAYOUT_DIRECTION to "layoutDirection",
      ActivityInfo.CONFIG_UI_MODE to "uiMode",
      ActivityInfo.CONFIG_DENSITY to "density",
      ActivityInfo.CONFIG_ORIENTATION to "orientation",
      ActivityInfo.CONFIG_SCREEN_SIZE to "screenSize",
      ActivityInfo.CONFIG_SMALLEST_SCREEN_SIZE to "smallestScreenSize",
      ActivityInfo.CONFIG_SCREEN_LAYOUT to "screenLayout",
      ActivityInfo.CONFIG_KEYBOARD to "keyboard",
      ActivityInfo.CONFIG_KEYBOARD_HIDDEN to "keyboardHidden",
      ActivityInfo.CONFIG_NAVIGATION to "navigation",
      ActivityInfo.CONFIG_TOUCHSCREEN to "touchscreen",
      ActivityInfo.CONFIG_MCC to "mcc",
      ActivityInfo.CONFIG_MNC to "mnc",
      ActivityInfo.CONFIG_COLOR_MODE to "colorMode",
    )
    private const val LOGS_PATH = "/api/logs/sdk"
  }
}
