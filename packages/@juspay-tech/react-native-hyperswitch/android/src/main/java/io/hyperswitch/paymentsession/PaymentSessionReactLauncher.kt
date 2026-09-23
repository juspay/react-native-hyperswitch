package io.hyperswitch.paymentsession

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
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
import io.hyperswitch.react.HyperActivity
import io.hyperswitch.react.HyperEventEmitter
import io.hyperswitch.react.HyperFragment
import io.hyperswitch.react.ReactNativeController

/**
 * React Native backed engine for presenting the payment sheet and running headless tasks.
 *
 * This class is intentionally independent of [hyperswitch-sdk-android-api]; callers are expected
 * to pass all configuration data as plain [Bundle]s or [Map]s.
 */
class PaymentSessionReactLauncher(
  private val activity: Activity,
) {

  private var reactHost: ReactHost? = null
  private var reactNativeHost: ReactNativeHost? = null
  private var reactContext: ReactContext? = null
  private var headlessTaskId: Int? = null

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
      } catch (e: Exception) {
      }

      val newReactNativeFragmentSheet =
        HyperFragment.Builder()
          .setComponentName("hyperSwitch")
          .setLaunchOptions(bundle)
          .setFabricEnabled(BuildConfig.IS_NEW_ARCHITECTURE_ENABLED)
          .build()

      // Scope the callback to the fragment's lifecycle — without an owner every
      // presentSheet() leaks another callback onto the host activity's dispatcher.
      // addCallback(owner) registers a LifecycleObserver, and LifecycleRegistry
      // enforces the main thread, so only THIS is posted. The transaction below
      // stays synchronous, exactly as it was before, so the surface mounts on the
      // same frame it always did.
      UiThreadUtil.runOnUiThread {
        fragmentActivity.onBackPressedDispatcher.addCallback(newReactNativeFragmentSheet) {
          newReactNativeFragmentSheet.onBackPressed()
        }
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
