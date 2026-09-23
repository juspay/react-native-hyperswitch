package io.hyperswitch.react

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.FragmentManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.fabric.mounting.SurfaceMountingManager
import com.facebook.react.uimanager.IllegalViewOperationException
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.UIManagerModule
import com.facebook.react.uimanager.common.UIManagerType
import com.hyperswitchsdkreactnative.BuildConfig
import com.hyperswitchsdkreactnative.NativeHyperModuleSpec
import io.hyperswitch.payments.GooglePayCallbackManager
import io.hyperswitch.paymentsession.LaunchOptions
import io.hyperswitch.paymentsession.PaymentSheetCallbackManager
import io.hyperswitch.webview.utils.HSWebViewManagerImpl
import io.hyperswitch.webview.utils.HSWebViewWrapper
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONObject
import io.hyperswitch.webview.utils.Callback as HSCallback

class HyperModule internal constructor(private val rct: ReactApplicationContext) :
  NativeHyperModuleSpec(rct) {
  companion object {

    const val NAME = "HyperModule"

    /**
     * Active HyperModule instance, registered when the module is constructed.
     * The fragment and EventEmitter route events through it so they flow via
     * the codegen typed EventEmitters, which work in bridgeless mode.
     */
    @Volatile
    private var activeInstance: HyperModule? = null

    fun getActiveInstance(): HyperModule? = activeInstance

    // Static methods with unique signatures for reflection access from lite SDK
    @JvmStatic
    fun confirmStatic(tag: String, map: MutableMap<String, String?>) {
      HyperEventEmitter.confirmStatic(tag, map)
    }

    @JvmStatic
    fun confirmCardStatic(map: MutableMap<String, String?>) {
      HyperEventEmitter.confirmCardStatic(map)
    }

    @JvmStatic
    fun confirmECStatic(map: MutableMap<String, String?>) {
      HyperEventEmitter.confirmECStatic(map)
    }
  }

  init {
    activeInstance = this
  }

  private val uiManagerType = if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
    UIManagerType.FABRIC
  } else {
    UIManagerType.DEFAULT
  }

  override fun getName(): String {
    HyperEventEmitter.initialize(rct)
    return NAME
  }

  // Using invalidate instead of deprecated onCatalystInstanceDestroy
  override fun invalidate() {
    super.invalidate()
    if (activeInstance === this) {
      activeInstance = null
    }
    HyperEventEmitter.deinitialize()
  }

  // --- Public wrappers around the codegen-protected emit methods ---
  // Used by HyperFragment / HyperEventEmitter to route events through the
  // codegen typed EventEmitters (bridgeless-compatible).
  fun emitConfirmEvent(payload: ReadableMap) = emitConfirm(payload)

  fun emitWidgetEvent(payload: ReadableMap) = emitWidget(payload)

  fun emitConfirmECEvent(payload: ReadableMap) = emitConfirmEC(payload)

  fun emitTriggerWidgetActionEvent(payload: ReadableMap) = emitTriggerWidgetAction(payload)

  fun emitUpdateIntentInitEvent(payload: ReadableMap) = emitUpdateIntentInit(payload)

  fun emitUpdateIntentCompleteEvent(payload: ReadableMap) = emitUpdateIntentComplete(payload)

  @ReactMethod
  override fun updateWidgetHeight(height: Double) {
    // Express checkout widget height adjustment is not yet implemented.
  }

  /**
   * Called from JS when a wallet confirm button is tapped.
   * Stores the callback; native later calls [resolveConfirmCallback] to proceed/abort.
   */
  @ReactMethod
  override fun onPaymentConfirmButtonClick(rootTag: Double, payload: String, callback: Callback) {
    findViewWithRootTag(rootTag.toInt()) {
      try {
        if (it == null) {
          callback.invoke(true)
        } else {
          it.notifyConfirmButtonClicked(payload, { it: Boolean ->
            callback.invoke(it)
          })
        }
      } catch (_: Exception) {
        callback.invoke(false)
      }
    }
  }

  @ReactMethod
  override fun sendMessageToNative(rnMessage: String) {
    val jsonObject = JSONObject(rnMessage)
    if (jsonObject.optBoolean("isReady", false)) {
      HyperEventEmitter.initialize(rct)
//            WidgetLauncher.onPaymentReadyCallback(true)
    }
  }

  // Method to launch Google Pay payment
  @ReactMethod
  override fun launchGPay(googlePayRequest: String, callBack: Callback) {
    reactApplicationContext.currentActivity?.let {
      GooglePayCallbackManager.setCallback(
        it,
        googlePayRequest,
        fun(data: Map<String, Any?>) {
          callBack.invoke(
            Arguments.fromBundle(
              LaunchOptions(
                it, BuildConfig.VERSION_NAME
              ).toBundle(data)
            )
          )
        },
      )
    } ?: run {
      GooglePayCallbackManager.setCallback(
        reactApplicationContext,
        googlePayRequest,
        fun(data: Map<String, Any?>) {
          callBack.invoke(
            Arguments.fromBundle(
              LaunchOptions(
                reactApplicationContext, BuildConfig.VERSION_NAME
              ).toBundle(data)
            )
          )
        },
      )
    }
  }

  override fun launchApplePay(
    requestObj: String?,
    callback: Callback?
  ) {
    callback?.invoke("Apple pay is not supported")
  }

  override fun startApplePay(
    requestObj: String?,
    callback: Callback?
  ) {
    callback?.invoke("Apple pay is not supported")
  }

  override fun presentApplePay(
    requestObj: String?,
    callback: Callback?
  ) {
    callback?.invoke("Apple pay is not supported")
  }

  // Method to exit the payment sheet
  @ReactMethod
  override fun exitPaymentsheet(rootTag: Double, paymentResult: String, reset: Boolean) {
    val isFragment = PaymentSheetCallbackManager.executeCallback(paymentResult)
    // Teardown touches views (clearFocus) and commits a fragment transaction, both
    // main-thread only, and this arrives on the JS thread like every other
    // @ReactMethod. Mirrors findViewWithRootTag below.
    UiThreadUtil.runOnUiThread {
      (reactApplicationContext.currentActivity as? FragmentActivity)?.let {
        if (isFragment) it.supportFragmentManager.findFragmentByTag("paymentSheet")
          ?.let { fragment ->
            // remove(), not hide(): nothing ever shows this fragment again — the next
            // presentSheet() removes and rebuilds it. hide() only marks the view GONE,
            // leaving the surface attached to android.R.id.content still holding input
            // focus, which makes the host app untouchable until it is restarted.
            it.currentFocus?.clearFocus()
            it.supportFragmentManager.beginTransaction().remove(fragment)
              .commitAllowingStateLoss()
          }
        else it.finish()
      }
    }
  }

  override fun exitPaymentMethodManagement(
    rootTag: Double,
    result: String?,
    reset: Boolean
  ) {
    TODO("Not yet implemented")
  }

  // Method to exit the widget
  @ReactMethod
  override fun exitWidget(paymentResult: String, widgetType: String) {
//        WidgetLaunche.onPaymentResultCallback(widgetType, paymentResult)
  }

  // Method to exit the card form
  @ReactMethod
  override fun exitCardForm(paymentResult: String) {
//        WidgetLauncher.onPaymentResultCallback(PaymentMethod.CARD.apiValue, paymentResult)
  }

  // Method to launch widget payment sheet
  @ReactMethod
  override fun launchWidgetPaymentSheet(paymentResult: String, callBack: Callback) {
  }

  // Method to exit widget payment sheet
  @ReactMethod
  override fun exitWidgetPaymentsheet(rootTag: Double, paymentResult: String, reset: Boolean) {
    findViewWithRootTag(rootTag.toInt(), {
      it?.notifyResult(CallbackType.PAYMENT_RESULT, paymentResult)
    })
  }

  @ReactMethod
  override fun notifyWidgetPaymentResult(rootTag: Double, result: String) {
    findViewWithRootTag(rootTag.toInt(), { fragment ->
      if (fragment == null) {
        Log.w(
          "HyperModule",
          "notifyWidgetPaymentResult: no fragment found for rootTag=$rootTag"
        )
      } else {
        fragment.notifyResult(CallbackType.CONFIRM_ACTION, result)
      }
    })
  }

  override fun onAddPaymentMethod(data: String?) {
    TODO("Not yet implemented")
  }

  @ReactMethod
  override fun onUpdateIntentEvent(rootTag: Double, type: String, result: String) {
    findViewWithRootTag(rootTag.toInt(), { fragment ->
      if (fragment == null) {
        Log.w("HyperModule", "onUpdateIntentEvent: no fragment found for rootTag=$rootTag")
        return@findViewWithRootTag
      }
      if (type == "UPDATE_INTENT_INIT_RETURNED") {
        fragment.notifyResult(CallbackType.UPDATE_INTENT_INIT, result)
      } else if (type == "UPDATE_INTENT_COMPLETE_RETURNED") {
        fragment.notifyResult(CallbackType.UPDATE_INTENT_COMPLETE, result)
      }
    })
  }

  // Variable to keep track of event listener count
  private val listenerCount = AtomicInteger(0)


  // Method to add event listener
  @ReactMethod
  override fun addListener(eventName: String?) {
    if (listenerCount.incrementAndGet() == 1) {
      HyperEventEmitter.initialize(rct)
    }
  }

  // Method to remove event listeners
  @ReactMethod
  override fun removeListeners(count: Double) {
    listenerCount.addAndGet(-count.toInt())
  }

  @ReactMethod
  override fun emitPaymentEvent(rootTag: Double, eventType: String, payload: ReadableMap) {
    findViewWithRootTag(rootTag.toInt(), { fragment ->
      if (fragment == null) {
        Log.w("HyperModule", "emitPaymentEvent: no fragment found for rootTag=$rootTag")
      } else {
        fragment.notifyEvent(eventType, payload)
      }
    })
  }

  @ReactMethod
  override fun openIframeBridge(url: String, timeoutMs: Double, callback: Callback) {
    if (timeoutMs <= 0) {
      callback.invoke("")
      return
    }
    if (url.isBlank()) {
      callback.invoke("")
      return
    }

    val mainHandler = Handler(Looper.getMainLooper())
    val callbackInvoked = AtomicBoolean(false)
    var webViewWrapper: HSWebViewWrapper? = null
    var timeoutRunnable: Runnable? = null

    val invokeCallback = { redirectUrl: String ->
      if (callbackInvoked.compareAndSet(false, true)) {
        timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        mainHandler.post {
          webViewWrapper?.let { wrapper ->
            try {
              (wrapper.parent as? ViewGroup)?.removeView(wrapper)
              wrapper.webView.stopLoading()
              wrapper.webView.destroy()
            } catch (_: Exception) {
            }
          }
          webViewWrapper = null
        }
        callback.invoke(redirectUrl)
      }
    }

    mainHandler.post {
      val activity = reactApplicationContext.currentActivity ?: run {
        invokeCallback("")
        return@post
      }

      val manager = HSWebViewManagerImpl(activity, HSCallback { _ -> })

      var wrapper: HSWebViewWrapper? = null
      repeat(2) { attempt ->
        if (wrapper != null) return@repeat
        try {
          wrapper = manager.createViewInstance()
        } catch (e: Exception) {
          if (attempt == 0) Thread.sleep(200)
        }
      }
      val resolvedWrapper = wrapper ?: run {
        invokeCallback("")
        return@post
      }

      manager.setJavaScriptEnabled(resolvedWrapper, true)

      val ddcBridge = object : Any() {
        @android.webkit.JavascriptInterface
        fun onMessage(data: String) {
          invokeCallback(data)
        }
      }
      resolvedWrapper.webView.addJavascriptInterface(ddcBridge, "HyperDDCBridge")

      resolvedWrapper.webView.webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
          if (request.isForMainFrame) {
            val url = request.url.toString()
            invokeCallback("{\"next_action\":{\"type\":\"redirect_to_url\",\"url\":\"$url\"}}")
            return true
          }
          return false
        }

        @Suppress("DEPRECATION")
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
          invokeCallback("{\"next_action\":{\"type\":\"redirect_to_url\",\"url\":\"$url\"}}")
          return true
        }
      }

      resolvedWrapper.apply {
        isFocusable = false
        isFocusableInTouchMode = false
        layoutParams = ViewGroup.LayoutParams(1, 1)
        translationX = -9999f
        translationY = -9999f
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
      }

      activity.findViewById<ViewGroup>(android.R.id.content).addView(resolvedWrapper)
      webViewWrapper = resolvedWrapper

      val wrapperHtml = """
                <html><body>
                <iframe src="$url" style="display:none;width:1px;height:1px;"></iframe>
                <script>
                window.addEventListener('message', function(event) {
                  var str = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
                  try { HyperDDCBridge.onMessage(str); } catch(e) {}
                });
                </script>
                </body></html>
            """.trimIndent()
      resolvedWrapper.webView.loadDataWithBaseURL(url, wrapperHtml, "text/html", "UTF-8", null)

      timeoutRunnable = Runnable { invokeCallback("") }.also {
        mainHandler.postDelayed(it, timeoutMs.toLong())
      }
    }
  }

  private fun findViewWithRootTag(rootTag: Int, onFound: (HyperFragment?) -> Unit) {
    UiThreadUtil.runOnUiThread {
      val uiManagerModule =
        UIManagerHelper.getUIManager(
          rct,
          uiManagerType
        )
      try {
        val view = uiManagerModule?.resolveView(rootTag)
        return@runOnUiThread onFound(view?.let { FragmentManager.findFragment(it) })
      } catch (e: IllegalViewOperationException) {
        return@runOnUiThread onFound(null)
      } catch (e: Exception) {
        return@runOnUiThread onFound(null)
      }
    }
  }
}
