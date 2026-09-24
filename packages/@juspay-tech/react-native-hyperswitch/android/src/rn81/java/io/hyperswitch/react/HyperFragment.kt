package io.hyperswitch.react

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import com.facebook.react.ReactFragment
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactRootView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.views.scroll.ReactHorizontalScrollView
import com.facebook.react.views.scroll.ReactScrollView
import com.hyperswitchsdkreactnative.BuildConfig
import com.proyecto26.inappbrowser.ChromeTabsDismissedEvent
import com.proyecto26.inappbrowser.ChromeTabsManagerActivity
import io.hyperswitch.PaymentEvent
import io.hyperswitch.PaymentEventListener
import io.hyperswitch.model.ElementUpdateIntentResult
import io.hyperswitch.paymentsession.ExitHeadlessCallBackManager
import io.hyperswitch.paymentsheet.PaymentResult
import io.hyperswitch.redirect.RedirectEvent
import io.hyperswitch.utils.ConversionUtils
import io.hyperswitch.utils.StandardResult
import org.greenrobot.eventbus.EventBus
import org.greenrobot.eventbus.Subscribe
import java.util.concurrent.ConcurrentHashMap

enum class EventName {
  CONFIRM_PAYMENT_ACTION,
  CONFIRM_CVC_PAYMENT
}

enum class CallbackType {
  PAYMENT_RESULT,
  CONFIRM_ACTION,
  CONFIRM_CVC_ACTION,
  UPDATE_INTENT_INIT,
  UPDATE_INTENT_COMPLETE,
  PAYMENT_CONFIRM_BUTTON_CLICK
}

sealed class HyperCallback {
  class Payment(val fn: (String) -> Unit) : HyperCallback()

  class UpdateIntentInit(
    val fn: (() -> Unit)?
  ) : HyperCallback()

  class UpdateIntentComplete(
    val fn: (String) -> Unit
  ) : HyperCallback()

  class ConfirmButtonTriggered(
    val callback: (
      data: String,
      onPaymentResultCallback: (Boolean) -> Unit
    ) -> Unit
  ) : HyperCallback()
}

class HyperFragment : ReactFragment() {

  private val callbacks = ConcurrentHashMap<CallbackType, HyperCallback>()

  /**
   * Dynamically returns the active ReactContext for both architectures.
   *
   * New architecture:
   * ReactHost.currentReactContext
   *
   * Old architecture:
   * ReactNativeHost.reactInstanceManager.currentReactContext
   */
  private val currentReactContext: ReactContext?
    get() = if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      ReactNativeController.getReactHost().currentReactContext
    } else {
      ReactNativeController.getReactNativeHost()
        .reactInstanceManager
        .currentReactContext
    }

  private var paymentEventListener: PaymentEventListener? = null
  private var onExit: (() -> Unit)? = null

  fun setOnExit(callback: () -> Unit) {
    onExit = callback
  }

  fun setOnPaymentResult(callback: (String) -> Unit) {
    callbacks[CallbackType.PAYMENT_RESULT] =
      HyperCallback.Payment(callback)
  }

  fun setOnPaymentConfirmButtonClick(
    callback: (
      data: String,
      onPaymentResultCallback: (Boolean) -> Unit
    ) -> Unit
  ) {
    callbacks[CallbackType.PAYMENT_CONFIRM_BUTTON_CLICK] =
      HyperCallback.ConfirmButtonTriggered(callback)
  }

  fun setOnEventCallback(listener: PaymentEventListener) {
    paymentEventListener = listener
  }

  private fun emitDeviceEvent(
    eventName: String,
    payload: Any?
  ): Boolean {
    val module = HyperModule.getActiveInstance()
    if (module != null && payload is ReadableMap) {
      try {
        when (eventName) {
          "confirm" -> module.emitConfirmEvent(payload)
          "widget" -> module.emitWidgetEvent(payload)
          "confirmEC" -> module.emitConfirmECEvent(payload)
          "triggerWidgetAction" -> module.emitTriggerWidgetActionEvent(payload)
          "updateIntentInit" -> module.emitUpdateIntentInitEvent(payload)
          "updateIntentComplete" -> module.emitUpdateIntentCompleteEvent(payload)
          else -> {
            // Unknown event — fall through to bridge path
            val reactContext = currentReactContext ?: return false
            reactContext.emitDeviceEvent(eventName, payload)
            return true
          }
        }
        return true
      } catch (_: Exception) {
        // Fall through to bridge path on failure
      }
    }
    val reactContext = currentReactContext ?: return false
    reactContext.emitDeviceEvent(eventName, payload)
    return true
  }

  private fun getRootTag(): Int {
    return reactDelegate.reactRootView?.rootViewTag ?: -1
  }

  fun updatePaymentIntentInit(callback: (() -> Unit)?) {
    val rootTag = getRootTag()

    if (rootTag == -1) {
      callback?.invoke()
      return
    }

    if (callbacks.containsKey(CallbackType.UPDATE_INTENT_INIT)) {
      callback?.invoke()
      return
    }

    callbacks[CallbackType.UPDATE_INTENT_INIT] =
      HyperCallback.UpdateIntentInit(callback)

    val emitted = emitDeviceEvent(
      eventName = "updateIntentInit",
      payload = Arguments.createMap().apply {
        putInt("rootTag", rootTag)
      }
    )

    if (!emitted) {
      callbacks.remove(CallbackType.UPDATE_INTENT_INIT)
      callback?.invoke()
    }
  }

  fun updatePaymentIntentComplete(
    sdkAuthorization: String,
    callback: (String) -> Unit
  ) {
    val rootTag = getRootTag()

    if (rootTag == -1) {
      callback(
        ElementUpdateIntentResult.Failure(
          Throwable("React context not ready").apply {
            initCause(Throwable("REACT_CONTEXT_NOT_READY"))
          }
        ).toString()
      )
      return
    }

    if (callbacks.containsKey(CallbackType.UPDATE_INTENT_COMPLETE)) {
      callback(
        ElementUpdateIntentResult.Failure(
          Throwable(
            "Update intent complete already in progress"
          ).apply {
            initCause(Throwable("ALREADY_IN_PROGRESS"))
          }
        ).toString()
      )
      return
    }

    callbacks[CallbackType.UPDATE_INTENT_COMPLETE] =
      HyperCallback.UpdateIntentComplete(callback)

    val emitted = emitDeviceEvent(
      eventName = "updateIntentComplete",
      payload = Arguments.createMap().apply {
        putString("sdkAuthorization", sdkAuthorization)
        putInt("rootTag", rootTag)
      }
    )

    if (!emitted) {
      callbacks.remove(CallbackType.UPDATE_INTENT_COMPLETE)

      callback(
        ElementUpdateIntentResult.Failure(
          Throwable("React context not ready").apply {
            initCause(Throwable("REACT_CONTEXT_NOT_READY"))
          }
        ).toString()
      )
    }
  }

  fun confirmPayment(callback: (String) -> Unit) {
    if (callbacks.containsKey(CallbackType.CONFIRM_ACTION)) {
      callback(
        StandardResult.Failed(
          error = Throwable("Payment already in progress")
        ).toJSONString()
      )
      return
    }

    val rootTag = getRootTag()

    if (rootTag == -1) {
      callback(
        StandardResult.Failed(
          error = Throwable("React context not ready")
        ).toJSONString()
      )
      return
    }

    if (callbacks.containsKey(CallbackType.UPDATE_INTENT_COMPLETE)) {
      callback(
        StandardResult.Failed(
          error = Throwable(
            "Payment intent update is in progress"
          )
        ).toJSONString()
      )
      return
    }

    callbacks[CallbackType.CONFIRM_ACTION] =
      HyperCallback.Payment(callback)

    val emitted = emitDeviceEvent(
      eventName = "triggerWidgetAction",
      payload = Arguments.createMap().apply {
        putString(
          "actionType",
          EventName.CONFIRM_PAYMENT_ACTION.name
        )
        putInt("rootTag", rootTag)
      }
    )

    if (!emitted) {
      callbacks.remove(CallbackType.CONFIRM_ACTION)

      callback(
        StandardResult.Failed(
          error = Throwable("React context not ready")
        ).toJSONString()
      )
    }
  }

  fun notifyResult(type: CallbackType, result: String) {
    try {
      when (type) {
        CallbackType.PAYMENT_RESULT -> {
          val confirmCallback =
            callbacks.remove(
              CallbackType.CONFIRM_ACTION
            ) as? HyperCallback.Payment

          val confirmCvcCallback =
            callbacks.remove(
              CallbackType.CONFIRM_CVC_ACTION
            ) as? HyperCallback.Payment

          when {
            confirmCallback != null -> {
              confirmCallback.fn(result)
              onExit?.invoke()
            }

            confirmCvcCallback != null -> {
              confirmCvcCallback.fn(result)
              onExit?.invoke()
            }

            else -> {
              (
                callbacks.remove(
                  CallbackType.PAYMENT_RESULT
                ) as? HyperCallback.Payment
                )?.fn?.invoke(result)

              onExit?.invoke()
            }
          }
        }

        CallbackType.UPDATE_INTENT_INIT -> {
          (
            callbacks.remove(
              CallbackType.UPDATE_INTENT_INIT
            ) as? HyperCallback.UpdateIntentInit
            )?.fn?.invoke()
        }

        CallbackType.UPDATE_INTENT_COMPLETE -> {
          (
            callbacks.remove(
              CallbackType.UPDATE_INTENT_COMPLETE
            ) as? HyperCallback.UpdateIntentComplete
            )?.fn?.invoke(result)
        }

        CallbackType.CONFIRM_ACTION -> {
          (
            callbacks.remove(
              CallbackType.CONFIRM_ACTION
            ) as? HyperCallback.Payment
            )?.fn?.invoke(result)
        }

        CallbackType.CONFIRM_CVC_ACTION -> {
          (
            callbacks.remove(
              CallbackType.CONFIRM_CVC_ACTION
            ) as? HyperCallback.Payment
            )?.fn?.invoke(result)
        }

        else -> {
          Log.i(
            TAG,
            "notifyResult: unhandled type $type"
          )
        }
      }
    } catch (_: Exception) {
    }
  }

  fun notifyConfirmButtonClicked(
    payload: String,
    callback: (Boolean) -> Unit
  ) {
    val confirmTriggeredCallback =
      callbacks[
        CallbackType.PAYMENT_CONFIRM_BUTTON_CLICK
      ] as? HyperCallback.ConfirmButtonTriggered

    if (confirmTriggeredCallback == null) {
      callback(true)
    } else {
      confirmTriggeredCallback.callback(
        payload,
        callback
      )
    }

    callbacks.remove(CallbackType.CONFIRM_ACTION)
  }

  fun notifyEvent(
    eventType: String,
    result: ReadableMap
  ) {
    try {
      val payload =
        ConversionUtils.readableMapToMap(result)

      val listener = paymentEventListener

      if (listener != null) {
        listener.onPaymentEvent(
          PaymentEvent(
            type = eventType,
            payload = payload
          )
        )
      } else {
        HyperEventEmitter.emitPaymentEvent(
          eventType,
          payload
        )
      }
    } catch (_: Exception) {
    }
  }

  fun confirmCvcPayment(
    sdkAuthorization: String,
    paymentToken: String,
    billing: String?,
    callback: (String) -> Unit
  ) {
    val rootTag = getRootTag()

    if (rootTag == -1) {
      callback(
        StandardResult.Failed(
          error = Throwable("Cannot find the React view")
        ).toJSONString()
      )
      return
    }

    val exitCallback: (String) -> Unit = { result ->
      callback(result)
    }

    val registered =
      ExitHeadlessCallBackManager.tryRegisterCallback(
        rootTag,
        exitCallback
      )

    if (!registered) {
      callback(
        StandardResult.Failed(
          error = Throwable(
            "CVC payment already in progress for this widget"
          ).apply {
            initCause(Throwable("ALREADY_IN_PROGRESS"))
          }
        ).toJSONString()
      )
      return
    }

    val payload = Arguments.createMap().apply {
      putString(
        "actionType",
        EventName.CONFIRM_CVC_PAYMENT.name
      )
      putInt("rootTag", rootTag)
      putString("sdkAuthorization", sdkAuthorization)
      putString("paymentToken", paymentToken)

      billing?.let {
        putString("billing", it)
      }
    }

    val emitted = emitDeviceEvent(
      eventName = "triggerWidgetAction",
      payload = payload
    )

    if (!emitted) {
      // ExitHeadlessCallBackManager.removeCallback(rootTag)

      callback(
        StandardResult.Failed(
          error = Throwable("React context not ready")
        ).toJSONString()
      )
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    registerEventBus()
  }

  override fun onViewCreated(
    view: View,
    savedInstanceState: Bundle?
  ) {
    super.onViewCreated(view, savedInstanceState)

    val reactRootView = view as? ReactRootView ?: return
    var scrollFixScheduled = false

    reactRootView.setOnHierarchyChangeListener(
      object : ViewGroup.OnHierarchyChangeListener {
        override fun onChildViewAdded(
          parent: View?,
          child: View?
        ) {
          if (scrollFixScheduled) {
            return
          }

          scrollFixScheduled = true

          view.post {
            scrollFixScheduled = false
            fixScrollInterception(reactRootView)
          }
        }

        override fun onChildViewRemoved(
          parent: View?,
          child: View?
        ) = Unit
      }
    )
  }

  override fun onDestroyView() {
    try {
      callbacks.clear()
      onExit = null
      paymentEventListener = null
    } finally {
      super.onDestroyView()
    }
  }

  override fun onDestroy() {
    try {
      unRegisterEventBus()
      callbacks.clear()
      onExit = null
      paymentEventListener = null
    } finally {
      super.onDestroy()
    }
  }

  @SuppressLint("ClickableViewAccessibility")
  private fun fixScrollInterception(root: ViewGroup) {
    root.isNestedScrollingEnabled = true

    findReactScrollViews(root).forEach { scrollView ->
      scrollView.isNestedScrollingEnabled = true

      scrollView.setOnTouchListener { view, event ->
        when (event.actionMasked) {
          MotionEvent.ACTION_DOWN,
          MotionEvent.ACTION_MOVE -> {
            view.parent
              ?.requestDisallowInterceptTouchEvent(true)
          }

          MotionEvent.ACTION_UP,
          MotionEvent.ACTION_CANCEL -> {
            view.parent
              ?.requestDisallowInterceptTouchEvent(false)
          }
        }

        false
      }
    }
  }

  private fun findReactScrollViews(
    root: ViewGroup
  ): List<ViewGroup> {
    val result = mutableListOf<ViewGroup>()

    for (index in 0 until root.childCount) {
      val child = root.getChildAt(index)

      if (
        child is ReactScrollView ||
        child is ReactHorizontalScrollView
      ) {
        result.add(child as ViewGroup)
      }

      if (child is ViewGroup) {
        result.addAll(findReactScrollViews(child))
      }
    }

    return result
  }

  private fun registerEventBus() {
    val eventBus = EventBus.getDefault()

    if (!eventBus.isRegistered(this)) {
      eventBus.register(this)
    }
  }

  private fun unRegisterEventBus() {
    val eventBus = EventBus.getDefault()

    if (eventBus.isRegistered(this)) {
      eventBus.unregister(this)
    }
  }

  @Subscribe
  fun onEvent(event: RedirectEvent) {
    unRegisterEventBus()

    EventBus.getDefault().post(
      ChromeTabsDismissedEvent(
        event.message,
        event.resultType,
        event.isError
      )
    )

    startActivity(
      ChromeTabsManagerActivity.createDismissIntent(
        requireContext()
      )
    )
  }

  @Deprecated(
    "You should not use ReactNativeHost directly in the New Architecture. Use ReactHost instead.",
    replaceWith = ReplaceWith("reactHost")
  )
  override val reactNativeHost: ReactNativeHost
    get() = ReactNativeController.getReactNativeHost()

  override val reactHost: ReactHost
    get() = ReactNativeController.getReactHost()
  class Builder {
    private var componentName: String? = null
    private var launchOptions: Bundle? = null
    private var fabricEnabled: Boolean = false

    fun setComponentName(componentName: String?) = apply {
      this.componentName = componentName
    }

    fun setLaunchOptions(launchOptions: Bundle?) = apply {
      this.launchOptions = launchOptions
    }

    fun setFabricEnabled(fabricEnabled: Boolean) = apply {
      this.fabricEnabled = fabricEnabled
    }

    fun build(): HyperFragment {
      return HyperFragment().also { fragment ->
        fragment.arguments = Bundle().apply {
          putString(ARG_COMPONENT_NAME, componentName)
          putBundle(ARG_LAUNCH_OPTIONS, launchOptions)
          putBoolean(ARG_FABRIC_ENABLED, fabricEnabled)
        }
      }
    }
  }

  companion object {
    private const val TAG = "HyperFragment"
  }
}
