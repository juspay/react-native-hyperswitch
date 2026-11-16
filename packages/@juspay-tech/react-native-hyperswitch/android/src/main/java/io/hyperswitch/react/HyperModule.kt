package io.hyperswitch.react

import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.FragmentManager
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
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
import com.hyperswitchsdkreactnative.modules.NativeLog
import io.hyperswitch.payments.GooglePayCallbackManager
import io.hyperswitch.paymentsession.LaunchOptions
import io.hyperswitch.paymentsession.PaymentSheetCallbackManager
import io.hyperswitch.webview.utils.HSWebViewClient
import io.hyperswitch.webview.utils.HSWebViewManagerImpl
import io.hyperswitch.webview.utils.HSWebViewWrapper
import java.io.ByteArrayInputStream
import java.net.URI
import java.util.Locale
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
    NativeLog.attach(rct)
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
    val activityName = currentActivity?.javaClass?.simpleName
    NativeLog.debug("wallet_launch_called", mapOf("wallet" to "google_pay", "activity" to activityName))
    if (currentActivity == null) {
      NativeLog.warning("wallet_launch_without_activity", mapOf("wallet" to "google_pay"))
    }
    currentActivity?.let {
      GooglePayCallbackManager.setCallback(
        it,
        googlePayRequest,
        fun(data: Map<String, Any?>) {
          NativeLog.debug("wallet_result_delivered", mapOf("wallet" to "google_pay", "status" to data["status"]?.toString()))
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
          NativeLog.debug("wallet_result_delivered", mapOf("wallet" to "google_pay", "status" to data["status"]?.toString()))
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
    NativeLog.debug(
      "exit_payment_sheet_resolved",
      mapOf("isFragment" to isFragment, "activityPresent" to (currentActivity != null))
    )
    (currentActivity as? FragmentActivity)?.let {
      if (isFragment) it.supportFragmentManager.findFragmentByTag("paymentSheet")
        ?.let { fragment ->
          it.supportFragmentManager.beginTransaction().hide(fragment)
            .commitAllowingStateLoss()
        }
      else it.finish()
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
  override fun emitMessageAction(
    rootTag: Double, paymentMethod: String, paymentMethodType: String, index: Double, text: String
  ) {
    findViewWithRootTag(rootTag.toInt(), { fragment ->
      /* The Activity-fallback sheet is not hosted in a fragment. */
      fragment?.onMessageAction(paymentMethod, paymentMethodType, index.toInt(), text)
        ?: PaymentSheetCallbackManager.messageAction?.invoke(paymentMethod, paymentMethodType, index.toInt(), text)
    })
  }

  @ReactMethod
  override fun openIframeBridge(url: String, timeoutMs: Double, callback: Callback) {
    fun webOrigin(value: String): String? {
      return try {
        val uri = URI(value)
        val host = uri.host?.lowercase(Locale.ROOT) ?: return null
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        if ((scheme != "https" && scheme != "http") || uri.rawUserInfo != null ||
          (uri.port != -1 && uri.port !in 1..65535)) return null
        val defaultPort = if (scheme == "https") 443 else 80
        val port = if (uri.port == -1 || uri.port == defaultPort) "" else ":${uri.port}"
        "$scheme://$host$port"
      } catch (_: Exception) {
        null
      }
    }

    val iframeOrigin = webOrigin(url)
    if (!timeoutMs.isFinite() || timeoutMs <= 0 || iframeOrigin == null) {
      callback.invoke("")
      return
    }

    val mainHandler = Handler(Looper.getMainLooper())
    val callbackInvoked = AtomicBoolean(false)
    var webViewWrapper: HSWebViewWrapper? = null
    var timeoutRunnable: Runnable? = null

    fun cleanupWebView(rendererGone: Boolean = false) {
      val wrapper = webViewWrapper ?: return
      webViewWrapper = null
      try {
        try {
          (wrapper.parent as? ViewGroup)?.removeView(wrapper)
          if (!rendererGone) wrapper.webView.stopLoading()
        } finally {
          wrapper.webView.destroy()
        }
      } catch (_: Exception) {
      }
    }

    val invokeCallback = { redirectUrl: String ->
      if (callbackInvoked.compareAndSet(false, true)) {
        timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        mainHandler.post { cleanupWebView() }
        callback.invoke(redirectUrl)
      }
    }

    mainHandler.post {
      val activity = currentActivity ?: run {
        invokeCallback("")
        return@post
      }

      val manager = HSWebViewManagerImpl(activity, HSCallback { _ -> })

      var wrapper: HSWebViewWrapper? = null
      repeat(2) { attempt ->
        if (wrapper != null) return@repeat
        try {
          if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            invokeCallback("")
            return@post
          }
          wrapper = manager.createViewInstance()
        } catch (e: Exception) {
          if (attempt == 0) Thread.sleep(200)
        }
      }
      val resolvedWrapper = wrapper ?: run {
        invokeCallback("")
        return@post
      }
      webViewWrapper = resolvedWrapper

      manager.setJavaScriptEnabled(resolvedWrapper, true)
      /* The wrapper's own client keeps its common handling (SSL errors, auth, events); DDC only
         adds its navigation rules and fails fast when the renderer dies. */
      resolvedWrapper.webView.webViewClient = object : HSWebViewClient() {
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
          super.onRenderProcessGone(view, detail)
          // A dead renderer's WebView must be destroyed without calling stopLoading().
          cleanupWebView(rendererGone = true)
          invokeCallback("")
          return true
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
          request.isForMainFrame

        @Deprecated("Deprecated in Java")
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = true

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
          if (request.isForMainFrame) {
            WebResourceResponse("text/plain", "UTF-8", ByteArrayInputStream(ByteArray(0)))
          } else {
            super.shouldInterceptRequest(view, request)
          }
      }
      try {
        WebViewCompat.addWebMessageListener(
          resolvedWrapper.webView, "HyperDDCBridge", setOf(iframeOrigin),
        ) { _, message, sourceOrigin, isMainFrame, _ ->
          if (!isMainFrame || webOrigin(sourceOrigin.toString()) != iframeOrigin ||
            message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
          val data = message.data ?: return@addWebMessageListener
          val json = try { JSONObject(data) } catch (_: Exception) { return@addWebMessageListener }
          // As on web: any message carrying next_action settles DDC, failing unless it is an http(s) redirect.
          if (!json.has("next_action")) return@addWebMessageListener
          val action = json.optJSONObject("next_action")
          val redirect = action?.opt("url") as? String
          val isValidRedirect = action?.opt("type") == "redirect_to_url" &&
            redirect != null && webOrigin(redirect) != null
          invokeCallback(if (isValidRedirect) json.toString() else "")
        }
      } catch (_: Exception) {
        invokeCallback("")
        return@post
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

      val wrapperHtml = """
        <html><body>
        <iframe id="ddc-frame" src="${TextUtils.htmlEncode(url)}" style="display:none;width:1px;height:1px;"></iframe>
        <script>
        window.addEventListener('message', function(event) {
         if (event.source !== document.getElementById('ddc-frame').contentWindow ||
           event.origin !== ${JSONObject.quote(iframeOrigin)}) return;
         try {
          var str = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
          if (typeof str === 'string') HyperDDCBridge.postMessage(str);
         } catch(e) {}
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
