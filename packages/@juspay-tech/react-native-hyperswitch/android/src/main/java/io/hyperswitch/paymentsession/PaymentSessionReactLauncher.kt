package io.hyperswitch.paymentsession

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.activity.addCallback
import androidx.fragment.app.FragmentActivity
import com.facebook.react.ReactHost
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.ReactNativeHost
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.common.LifecycleState
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler
import com.facebook.react.uimanager.PixelUtil
import com.hyperswitchsdkreactnative.BuildConfig
import io.hyperswitch.model.HyperswitchBaseConfiguration
import io.hyperswitch.model.PaymentSessionConfiguration
import io.hyperswitch.paymentsheet.PaymentResult
import io.hyperswitch.react.HyperActivity
import io.hyperswitch.react.HyperEventEmitter
import io.hyperswitch.react.HyperFragment
import io.hyperswitch.react.HyperReactRuntime
import io.hyperswitch.react.ReactNativeController
import io.hyperswitch.react.UpdateIntentReplyTarget
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * React Native backed engine for presenting the payment sheet and running headless tasks.
 *
 * This class is intentionally independent of [hyperswitch-sdk-android-api]; callers are expected
 * to pass all configuration data as plain [Bundle]s or [Map]s.
 */
class PaymentSessionReactLauncher(
  private val activity: Activity,
  hsConfig: HyperswitchBaseConfiguration? = null,
) : UpdateIntentReplyTarget {

  private var reactHost: ReactHost? = null
  private var reactNativeHost: ReactNativeHost? = null
  private var reactContext: ReactContext? = null
  private var headlessTaskId: Int? = null

  var sessionConfig: PaymentSessionConfiguration? = null

  /** The running prefetch surface and the props it currently renders. */
  private class Prefetch(val surface: HeadlessSurface, val props: Bundle)

  /** Written on the main thread; read from any thread through [sessionTag]. */
  @Volatile
  private var prefetch: Prefetch? = null
  private val prefetchSurface: HeadlessSurface?
    get() = prefetch?.surface

  /** Set by [close]: no surface is started again for this session. */
  @Volatile
  private var closed = false

  /** Numbers updateIntent calls so the surface can tell consecutive ones apart. */
  private var updateIntentSequence = 0
  private var savedPaymentMethods: Pair<HeadlessSurface, HeadlessAttempt>? = null
  private val launchOptions = LaunchOptions(activity, BuildConfig.VERSION_NAME, hsConfig)
  private val mainHandler = Handler(Looper.getMainLooper())

  /** Root tag of the prefetch surface: the session's identity in JS. Null until prefetched. */
  val sessionTag: Int?
    get() = prefetchSurface?.rootTag

  /** One updateIntent in flight; identity-checked on finish so a stale terminal event cannot end a later attempt. */
  private class UpdateIntentAttempt(val onResult: (Result<String>) -> Unit) {
    var authorization: String? = null
  }

  @Volatile
  private var updateIntentAttempt: UpdateIntentAttempt? = null

  /** True between `updateIntent` being called and its result; confirms are refused meanwhile. */
  val isUpdatingIntent: Boolean
    get() = updateIntentAttempt != null

  @SuppressLint("VisibleForTests")
  fun initializeReactNativeInstance() {
    reactContext = try {
      // Get ReactNativeHost from ReactNativeController singleton instead of casting Application to ReactApplication
      // This allows merchants to use their own Application class without extending MainApplication
      if (!ReactNativeController.getIsInitialized()) {
        ReactNativeController.initialize(activity.application)
      }
      reactNativeHost = ReactNativeController.getReactNativeHost()
      reactHost = ReactNativeController.getReactHost()
      // The host runs this session's JS only while its Activity is resumed.
      HyperReactRuntime.follow(activity)

      if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
        val reactHost = checkNotNull(reactHost) { "ReactHost is not initialized in New Architecture" }
        reactHost.currentReactContext
      } else {
        val reactInstanceManager = reactNativeHost?.reactInstanceManager
        reactInstanceManager?.currentReactContext
      }
    } catch (ex: IllegalStateException) {
      throw IllegalStateException(
        "HyperSDK not initialized. Please call HyperSDK.initialize() in your Application.onCreate()",
        ex
      )
    } catch (ex: RuntimeException) {
      throw IllegalStateException(
        "Failed to initialize React Native instance. " + "Please check your AndroidManifest.xml and React Native configuration.",
        ex
      )
    }
  }

  private fun runOnMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post(block)
  }

  // ── Prefetch surface ──────────────────────────────────────────────────────

  /**
   * Main thread. Starts the prefetch surface once, under the current [sessionConfig]. Its
   * root tag is the session's identity for every other surface, so it is never replaced:
   * changed credentials reach it through its props. Null before [initPaymentSession] and
   * after [close].
   */
  private fun ensurePrefetch(): HeadlessSurface? {
    prefetch?.let { return it.surface }
    if (closed) return null
    val config = sessionConfig ?: return null
    val props = bottomInsetToDIPFromPixel(
      launchOptions.getBundle("payment", config, Bundle(), emptyList())
    )
    // getBundle hardcodes type=payment.
    props.getBundle("props")?.putString("type", "prefetch")
    return HeadlessSurface.start(activity.applicationContext, ReactNativeController.getOrRecreateReactHost(activity.application), props, owner = this)
      .also { prefetch = Prefetch(it, props) }
  }

  /**
   * Starts the prefetch surface, or moves a running one to the current [sessionConfig]:
   * React re-renders it under the new credentials and JS fetches for them.
   */
  fun prefetch() {
    runOnMain {
      val current = prefetch
      if (current == null) {
        ensurePrefetch()
        return@runOnMain
      }
      val config = sessionConfig ?: return@runOnMain
      failPendingUpdateIntent("SESSION_REINITIALISED", "initPaymentSession replaced the intent while updateIntent was in flight")
      updateIntentSequence += 1
      pushUpdateIntent("complete", config)
      savedPaymentMethods?.second?.sdkAuthorization = config.sdkAuthorization
    }
  }

  /** Resolves once the prefetch surface is running, which is when its data is on its way. */
  suspend fun awaitReady() {
    val surface = withContext(Dispatchers.Main.immediate) { ensurePrefetch() } ?: return
    surface.awaitStarted()
  }

  // ── Update intent ─────────────────────────────────────────────────────────

  /**
   * Drives the prefetch surface through its props, not events: `init` marks the update
   * (overlay on the session's other surfaces), asks the merchant for the new authorization,
   * then `complete` carries the new credentials and the surface refetches and fans out in
   * JS. There is no timer: the attempt ends with the JS reply, or with the native event
   * that rules a reply out (the session closed or re-initialised). Config commits on success.
   */
  fun updateIntent(
    authorizationProvider: (onAuthorization: (String) -> Unit) -> Unit,
    onResult: (Result<String>) -> Unit
  ) {
    mainHandler.post {
      if (updateIntentAttempt != null) {
        onResult(Result.failure(failure("ALREADY_IN_PROGRESS", "updateIntent already in progress")))
        return@post
      }
      if (ensurePrefetch() == null) {
        val (code, message) =
          if (closed) "SESSION_CLOSED" to "The payment session was closed"
          else "NOT_INITIALISED" to "initPaymentSession has not been called"
        onResult(Result.failure(failure(code, message)))
        return@post
      }
      val attempt = UpdateIntentAttempt(onResult)
      updateIntentAttempt = attempt
      updateIntentSequence += 1
      pushUpdateIntent("init", configuration = null)

      authorizationProvider { auth ->
        mainHandler.post { refetch(auth, attempt) }
      }
    }
  }

  private fun refetch(auth: String, attempt: UpdateIntentAttempt) {
    if (updateIntentAttempt !== attempt) return
    if (auth.isEmpty()) {
      // The overlay went up on `init`; JS lowers it on `cancel`.
      pushUpdateIntent("cancel", configuration = null)
      finish(attempt, Result.failure(failure("INVALID_SDK_AUTHORIZATION", "No sdkAuthorization was provided")))
      return
    }
    if (prefetch == null) {
      finish(attempt, Result.failure(failure("SESSION_CLOSED", "The payment session was closed")))
      return
    }
    attempt.authorization = auth

    pushUpdateIntent("complete", PaymentSessionConfiguration(auth))
  }

  /**
   * Main thread. Re-renders the prefetch root with an `updateIntent` marker and, for
   * `complete`, the new `paymentSessionConfig`. The surface then carries the attempted
   * credentials whatever the outcome, as JS switched to them; [sessionConfig] only commits
   * on success.
   *
   * Mutating the retained bundle is safe: React never keeps a reference to it. The surface
   * constructor and [HeadlessSurface.updateProps] both deep-copy it into a NativeMap
   * (`Arguments.fromBundle`) synchronously on the calling thread, and every caller of this
   * function runs on the main thread, so nothing reads the bundle in between.
   */
  private fun pushUpdateIntent(phase: String, configuration: PaymentSessionConfiguration?) {
    val current = prefetch ?: return
    val inner = current.props.getBundle("props") ?: return
    configuration?.let { inner.putBundle("paymentSessionConfig", it.toBundle()) }
    inner.putBundle("updateIntent", Bundle().apply {
      putInt("attempt", updateIntentSequence)
      putString("phase", phase)
    })
    current.surface.updateProps(current.props)
  }

  /** JS reply, routed here because this launcher owns the prefetch surface it came from. */
  override fun onUpdateIntentReply(eventType: String, resultJson: String) {
    mainHandler.post { handleUpdateIntentReply(eventType, resultJson) }
  }

  private fun handleUpdateIntentReply(type: String, resultJson: String) {
    if (type != "UPDATE_INTENT_COMPLETE_RETURNED") return
    val attempt = updateIntentAttempt ?: return
    val auth = attempt.authorization ?: ""
    val result = parseUpdateIntentResult(resultJson, auth)
    if (result.isSuccess) {
      sessionConfig = PaymentSessionConfiguration(auth)
      savedPaymentMethods?.second?.sdkAuthorization = auth
    }
    finish(attempt, result)
  }

  private fun finish(attempt: UpdateIntentAttempt, result: Result<String>) {
    if (updateIntentAttempt !== attempt) return
    updateIntentAttempt = null
    attempt.onResult(result)
  }

  /**
   * Ends the attempt in flight once native knows its JS reply can no longer arrive, and
   * tells the surface so the session's other surfaces lower their overlay.
   */
  private fun failPendingUpdateIntent(code: String, message: String) {
    updateIntentAttempt?.let {
      pushUpdateIntent("cancel", configuration = null)
      finish(it, Result.failure(failure(code, message)))
    }
  }

  private fun parseUpdateIntentResult(json: String, auth: String): Result<String> = try {
    val obj = JSONObject(json)
    when (val status = obj.optString("status")) {
      "failed", "error", "cancelled" -> Result.failure(
        failure(
          obj.optString("code").ifEmpty { "UNKNOWN_ERROR" },
          obj.optString("message").ifEmpty { status },
        )
      )
      else -> Result.success(auth)
    }
  } catch (e: Exception) {
    Result.failure(failure("UNKNOWN_ERROR", "Invalid update intent result"))
  }

  private fun failure(code: String, message: String): Throwable =
    Throwable(message).apply { initCause(Throwable(code)) }


  /**
   * Recreates the React context (if needed) and starts a headless JS task with the supplied
   * [bundle]. The caller is responsible for assembling the bundle (e.g. via [LaunchOptions]).
   */
  fun recreateReactContext(bundle: Bundle) {
    activity.runOnUiThread {
      var context = reactContext
      if (context == null) {
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
          // Live surfaces bind their host at fragment-attach time; forcing all
          // routes through getOrRecreateReactHost() ensures a DESTROYED host is
          // swapped out before any fragment/activity can re-bind to it.
          val host = ReactNativeController.getOrRecreateReactHost(activity.application)
          reactHost = host

          context = host.currentReactContext
          if (context != null) {
            startHeadlessTask(context, bundle)
            reactContext = context
            return@runOnUiThread
          }

          host.addReactInstanceEventListener(
            object : ReactInstanceEventListener {
              override fun onReactContextInitialized(context: ReactContext) {
                startHeadlessTask(context, bundle)
                reactContext = host.currentReactContext ?: context
                host.removeReactInstanceEventListener(this)
              }
            }
          )
          when (host.lifecycleState) {
            // Instance died (JS crash/invalidate) but host is still alive.
            LifecycleState.RESUMED, LifecycleState.BEFORE_RESUME ->
              host.reload("headless-session-recreate")
            // Fresh/recreated (or not-yet-started) host. start() is idempotent
            // while a ReactInstance creation is already in flight.
            else -> host.start()
          }
        } else {
          val reactInstanceManager = reactNativeHost?.reactInstanceManager
          reactInstanceManager?.addReactInstanceEventListener(
            object : ReactInstanceEventListener {
              override fun onReactContextInitialized(context: ReactContext) {
                startHeadlessTask(context, bundle)
                reactContext = reactInstanceManager.currentReactContext
                reactInstanceManager.removeReactInstanceEventListener(this)
              }
            }
          )
          reactInstanceManager?.run {
            // recreateReactContextInBackground() cleanly tears down any old
            // (possibly dead) context before creating a new one, unlike
            // createReactContextInBackground() which no-ops once started.
            if (hasStartedCreatingInitialContext()) {
              recreateReactContextInBackground()
            } else {
              createReactContextInBackground()
            }
          }
        }
      } else {
        startHeadlessTask(context, bundle)
      }
    }
  }

  /**
   * Starts a HyperHeadless surface in saved-payment-methods mode. Its owner is a
   * [HeadlessAttempt] that delivers the handler and routes confirms; a new call
   * replaces the previous surface and fails whatever it still had pending.
   */
  fun startSavedPaymentMethods(
    bundle: Bundle,
    onHandler: (PaymentSessionHandler) -> Unit,
  ) {
    runOnMain {
      if (closed) {
        val reason = "The payment session was closed"
        val failure = Arguments.createMap().apply {
          putString("code", "SESSION_CLOSED")
          putString("message", reason)
        }
        val refused = HeadlessAttempt("", onHandler).apply {
          refuseConfirms(PaymentResult.Failed(Throwable(reason).apply { initCause(Throwable("SESSION_CLOSED")) }))
        }
        onHandler(PaymentSessionHandlerImpl(refused, failure, failure, Arguments.createArray()))
        return@runOnMain
      }
      applySessionConfig(bundle)
      stampSessionTag(bundle)
      val attempt = HeadlessAttempt(
        sessionConfig?.sdkAuthorization ?: "",
        onHandler,
        updating = { updateIntentAttempt != null },
      )
      savedPaymentMethods?.let { (surface, previous) ->
        previous.cancel()
        surface.stop()
      }
      savedPaymentMethods = HeadlessSurface.start(
        activity.applicationContext, ReactNativeController.getOrRecreateReactHost(activity.application), bundle, attempt
      ) to attempt
    }
  }

  private fun startHeadlessTask(reactContext: ReactContext, bundle: Bundle) {
    val taskConfig = HeadlessJsTaskConfig(
      "HyperHeadless", Arguments.fromBundle(bundle), 5000, true, null
    )

    val headlessJsTaskContext = HeadlessJsTaskContext.getInstance(reactContext)
    UiThreadUtil.runOnUiThread {
      headlessTaskId?.let {
        headlessJsTaskContext.finishTask(it)
      }
      headlessTaskId = headlessJsTaskContext.startTask(taskConfig)
    }
  }

  /**
   * Presents the payment sheet using a fully prepared launch [bundle].
   *
   * The bundle is expected to contain a `props` bundle with `configuration`, `sdkParams`, etc.
   */
  fun presentSheet(bundle: Bundle): Boolean {
    stampSessionTag(bundle)
    applyFonts(bundle)
    return presentSheetInternal(bottomInsetToDIPFromPixel(bundle))
  }

  private fun presentSheetInternal(bundle: Bundle): Boolean {
    if (activity is DefaultHardwareBackBtnHandler && activity is FragmentActivity) {
      val fragmentActivity = activity as FragmentActivity
      val fragmentManager = fragmentActivity.supportFragmentManager
      try {
        fragmentManager.findFragmentByTag("paymentSheet")?.let { existingFragment ->
          fragmentManager.beginTransaction()
            .remove(existingFragment)
            .commitNowAllowingStateLoss()
        }
      }catch(e:Exception){
      }

      val newReactNativeFragmentSheet =
        HyperFragment.Builder()
          .setComponentName("hyperSwitch")
          .setLaunchOptions(bundle)
          .setFabricEnabled(BuildConfig.IS_NEW_ARCHITECTURE_ENABLED)
          .build()

      fragmentActivity.onBackPressedDispatcher.addCallback {
        newReactNativeFragmentSheet.onBackPressed()
      }

      fragmentManager.beginTransaction()
        .add(android.R.id.content, newReactNativeFragmentSheet, "paymentSheet")
        .commitAllowingStateLoss()

      return true
    } else {
      activity.startActivity(
        Intent(
          activity.applicationContext,
          HyperActivity::class.java
        ).apply {
          putExtra("flow", 1)
          putExtra("configuration", bundle)
        })
      return false
    }
  }


  /** Stops every surface this session started and fails what is still waiting on them. */
  fun close() {
    runOnMain {
      closed = true
      failPendingUpdateIntent("SESSION_CLOSED", "The payment session was closed")
      savedPaymentMethods?.let { (surface, attempt) ->
        attempt.cancel()
        surface.stop()
      }
      savedPaymentMethods = null
      prefetchSurface?.stop()
      prefetch = null
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * The wrapper builds the saved-methods props from what TS sent, which still carries the
   * credentials the session started with; client-core builds them from [sessionConfig], so the
   * session's current credentials (moved by updateIntent) replace them here.
   */
  private fun applySessionConfig(bundle: Bundle) {
    val config = sessionConfig ?: return
    bundle.getBundle("props")?.putBundle("paymentSessionConfig", config.toBundle())
  }

  /** Surfaces of this session carry its tag so JS scopes session-wide events to it. */
  private fun stampSessionTag(bundle: Bundle) {
    val tag = prefetchSurface?.rootTag ?: return
    bundle.getBundle("props")?.getBundle("sdkParams")?.putInt("sessionTag", tag)
  }

  /**
   * Loads any custom fonts declared in the configuration bundle and rewrites the font entries
   * so React Native can resolve them by family name.
   */
  private fun applyFonts(bundle: Bundle) {
    val configuration = bundle.getBundle("props")?.getBundle("configuration") ?: return
    val appearance = configuration.getBundle("appearance") ?: return

    appearance.getBundle("font")?.let { font ->
      loadFontAndUpdateBundle(font)
    }

    appearance.getBundle("primaryButton")?.getBundle("typography")?.let { typography ->
      loadFontAndUpdateBundle(typography)
    }
  }

  private fun loadFontAndUpdateBundle(fontBundle: Bundle) {
    if (!fontBundle.containsKey("fontResId")) return
    val fontResId = fontBundle.getInt("fontResId", 0)
    if (fontResId == 0) return

    try {
      val family = activity.resources.getResourceName(fontResId).split("/")[1]
      ReactFontManager.getInstance().addCustomFont(activity, family, fontResId)
      fontBundle.remove("fontResId")
      fontBundle.putString("family", family)
    } catch (_: Exception) {
      // Ignore invalid font resources.
    }
  }

  private fun bottomInsetToDIPFromPixel(bundle: Bundle): Bundle {
    val propsBundle = bundle.getBundle("props")
    val sdkParamsBundle = propsBundle?.getBundle("sdkParams")
    sdkParamsBundle?.getFloat("topInset")?.let { dipValue ->
      sdkParamsBundle.putFloat("topInset", PixelUtil.toDIPFromPixel(dipValue))
    }
    sdkParamsBundle?.getFloat("leftInset")?.let { dipValue ->
      sdkParamsBundle.putFloat("leftInset", PixelUtil.toDIPFromPixel(dipValue))
    }
    sdkParamsBundle?.getFloat("rightInset")?.let { dipValue ->
      sdkParamsBundle.putFloat("rightInset", PixelUtil.toDIPFromPixel(dipValue))
    }
    sdkParamsBundle?.getFloat("bottomInset")?.let { dipValue ->
      sdkParamsBundle.putFloat("bottomInset", PixelUtil.toDIPFromPixel(dipValue))
    }
    return bundle
  }
}
