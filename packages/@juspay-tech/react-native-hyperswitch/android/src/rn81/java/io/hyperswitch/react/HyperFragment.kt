package io.hyperswitch.react

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.interfaces.fabric.ReactSurface
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler
import com.facebook.react.runtime.ReactSurfaceImpl
import com.facebook.react.views.scroll.ReactHorizontalScrollView
import com.facebook.react.views.scroll.ReactScrollView
import com.proyecto26.inappbrowser.ChromeTabsDismissedEvent
import com.proyecto26.inappbrowser.ChromeTabsManagerActivity
import io.hyperswitch.PaymentEvent
import io.hyperswitch.PaymentEventListener
import io.hyperswitch.model.ElementUpdateIntentResult
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

/**
 * Owner of one visible surface (sheet, payment widget or CVC widget) on the
 * shared host. Mirrors hyperswitch-client-core's HyperFragment: the fragment
 * owns a [ReactSurfaceImpl] and drives it directly — confirm/update commands
 * travel as props pushed through [pushProps] (`widgetConfirm`, `cvcConfirm`),
 * which is the trigger contract of the shared JS bundle. The host's lifecycle
 * follows the Activity, not this fragment: a session's surfaces outlive the
 * sheet, so dismissing it must not put the host to sleep.
 */
class HyperFragment : Fragment(), DefaultLifecycleObserver {

  private val callbacks = ConcurrentHashMap<CallbackType, HyperCallback>()

  private var hyperSurface: ReactSurface? = null

  /**
   * The props the surface renders, copied from the launch options so a command pushed
   * through them never lands in [getArguments]: a fragment the OS recreates must start
   * from the original props, not replay the last confirm.
   */
  private var liveLaunchOptions: Bundle? = null

  fun currentSurfaceId(): Int {
    val id = hyperSurface?.surfaceID ?: return -1
    return if (id > 0) id else -1
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

  fun hasPaymentResultCallback(): Boolean =
    callbacks.containsKey(CallbackType.PAYMENT_RESULT)

  fun setOnPaymentConfirmButtonClick(
    callback: (
      data: String,
      onPaymentResultCallback: ((Boolean) -> Unit)
    ) -> Unit
  ) {
    callbacks[CallbackType.PAYMENT_CONFIRM_BUTTON_CLICK] =
      HyperCallback.ConfirmButtonTriggered(callback)
  }

  fun setOnEventCallback(listener: PaymentEventListener) {
    paymentEventListener = listener
  }

  private val currentReactContext: ReactContext?
    get() = try {
      ReactNativeController.getOrRecreateReactHost(
        requireActivity().application
      ).currentReactContext
    } catch (_: Exception) {
      null
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

  private fun getRootTag(): Int = currentSurfaceId()

  private var confirmSequence = 0

  /**
   * Main thread. Re-renders this fragment's React root with [update] applied to its props;
   * React delivers new props whether the root has rendered yet or not, so a command sent
   * this way is never lost to timing. False when the fragment has no surface.
   */
  private fun pushProps(update: Bundle.() -> Unit): Boolean {
    val surface = hyperSurface as? ReactSurfaceImpl ?: return false
    val launchOptions = liveLaunchOptions ?: return false
    val props = launchOptions.getBundle("props") ?: return false
    props.update()
    surface.updateInitProps(launchOptions)
    return true
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

  /**
   * Confirms through the widget's own React root: a `widgetConfirm` marker on its props.
   * JS answers through `notifyWidgetPaymentResult` for this root tag.
   */
  fun confirmPayment(callback: (String) -> Unit) {
    UiThreadUtil.runOnUiThread {
      if (callbacks.containsKey(CallbackType.CONFIRM_ACTION)) {
        callback(
          StandardResult.Failed(
            error = Throwable("Payment already in progress")
          ).toJSONString()
        )
        return@runOnUiThread
      }

      if (callbacks.containsKey(CallbackType.UPDATE_INTENT_COMPLETE)) {
        callback(
          StandardResult.Failed(
            error = Throwable(
              "Payment intent update is in progress"
            )
          ).toJSONString()
        )
        return@runOnUiThread
      }

      callbacks[CallbackType.CONFIRM_ACTION] =
        HyperCallback.Payment(callback)

      confirmSequence += 1
      val attempt = confirmSequence
      val pushed = pushProps {
        putBundle(
          "widgetConfirm",
          Bundle().apply { putInt("attempt", attempt) }
        )
      }

      if (!pushed) {
        callbacks.remove(CallbackType.CONFIRM_ACTION)
        callback(
          StandardResult.Failed(
            error = Throwable("React Context not ready")
          ).toJSONString()
        )
      }
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
    } catch (e: Exception) {
      Log.e(TAG, "Error in notifyResult", e)
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

  /**
   * Called directly on this instance for streaming widget lifecycle events.
   */
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
    } catch (e: Exception) {
      Log.e(TAG, "Error in notifyEvent", e)
    }
  }

  /**
   * Confirms the saved method through the CVC widget's own React root: a `cvcConfirm`
   * request on its props. The widget has no session, so the credentials travel with it.
   * JS answers through `exitHeadless` for this root tag.
   */
  fun confirmCvcPayment(
    sdkAuthorization: String,
    paymentToken: String,
    billing: String?,
    callback: (String) -> Unit
  ) {
    UiThreadUtil.runOnUiThread {
      // One confirm at a time per widget; the JS reply resolves the slot.
      val registered =
        callbacks.putIfAbsent(
          CallbackType.CONFIRM_CVC_ACTION,
          HyperCallback.Payment(callback)
        ) == null

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
        return@runOnUiThread
      }

      confirmSequence += 1
      val attempt = confirmSequence
      val pushed = pushProps {
        putBundle("cvcConfirm", Bundle().apply {
          putInt("attempt", attempt)
          putString("sdkAuthorization", sdkAuthorization)
          putString("paymentToken", paymentToken)
          billing?.let { putString("billing", it) }
        })
      }

      if (!pushed) {
        callbacks.remove(CallbackType.CONFIRM_CVC_ACTION)
        callback(
          StandardResult.Failed(
            error = Throwable("Cannot find the React view")
          ).toJSONString()
        )
      }
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  override fun onCreate(savedInstanceState: Bundle?) {
    // The OS can recreate this fragment after process death before the host app
    // initialised the SDK; initialize() is idempotent.
    activity?.application?.let(ReactNativeController::initialize)
    super<Fragment>.onCreate(savedInstanceState)
    follow(requireActivity())
    registerEventBus()
  }

  /**
   * Makes the host follow [activity]'s lifecycle: JS timers (and therefore every
   * fetch) run only while the host is resumed. Every AndroidX Activity is a
   * LifecycleOwner; a plain Activity is taken as resumed immediately.
   */
  private fun follow(activity: Activity) {
    if (activity is LifecycleOwner) {
      activity.lifecycle.addObserver(this)
    } else {
      activity.application.registerActivityLifecycleCallbacks(ResumeHost(activity))
      ReactNativeController.getReactHost()
        .onHostResume(activity, activity as? DefaultHardwareBackBtnHandler)
    }
  }

  private inner class ResumeHost(private val activity: Activity) :
    android.app.Application.ActivityLifecycleCallbacks {
    override fun onActivityResumed(resumed: Activity) {
      if (resumed === activity) {
        ReactNativeController.getReactHost()
          .onHostResume(activity, activity as? DefaultHardwareBackBtnHandler)
      }
    }

    override fun onActivityPaused(paused: Activity) {
      if (paused === activity) ReactNativeController.getReactHost().onHostPause()
    }

    override fun onActivityDestroyed(destroyed: Activity) {
      if (destroyed !== activity) return
      ReactNativeController.getReactHost().onHostDestroy(activity)
      activity.application.unregisterActivityLifecycleCallbacks(this)
    }

    override fun onActivityCreated(a: Activity, s: Bundle?) {}
    override fun onActivityStarted(a: Activity) {}
    override fun onActivityStopped(a: Activity) {}
    override fun onActivitySaveInstanceState(a: Activity, outState: Bundle) {}
  }

  override fun onResume(owner: LifecycleOwner) {
    (owner as? Activity)?.let {
      ReactNativeController.getReactHost()
        .onHostResume(it, it as? DefaultHardwareBackBtnHandler)
    }
  }

  override fun onPause(owner: LifecycleOwner) {
    ReactNativeController.getReactHost().onHostPause()
  }

  override fun onDestroy(owner: LifecycleOwner) {
    ReactNativeController.getReactHost().onHostDestroy(owner as Activity)
    owner.lifecycle.removeObserver(this)
  }

  override fun onCreateView(
    inflater: LayoutInflater,
    container: ViewGroup?,
    savedInstanceState: Bundle?
  ): View? {
    val componentName =
      arguments?.getString(ARG_COMPONENT_NAME) ?: "hyperSwitch"
    val launchOptions =
      arguments?.getBundle(ARG_LAUNCH_OPTIONS)?.let { original ->
        Bundle(original).apply {
          getBundle("props")?.let { putBundle("props", Bundle(it)) }
        }
      }
    liveLaunchOptions = launchOptions

    val host = try {
      ReactNativeController.getOrRecreateReactHost(requireActivity().application)
    } catch (_: Exception) {
      ReactNativeController.getReactHost()
    }

    val surface = host.createSurface(requireActivity(), componentName, launchOptions)
    surface.view?.let { SurfaceOwners.attach(it, this) }
    hyperSurface = surface
    surface.start()
    return surface.view
  }

  override fun onViewCreated(
    view: View,
    savedInstanceState: Bundle?
  ) {
    super.onViewCreated(view, savedInstanceState)

    val reactRootView = view as? ViewGroup ?: return
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
      hyperSurface?.view?.let { SurfaceOwners.attach(it, null) }
      hyperSurface?.stop()
      hyperSurface = null
      liveLaunchOptions = null
      callbacks.clear()
      onExit = null
      paymentEventListener = null
    } catch (_: Exception) {
    } finally {
      super<Fragment>.onDestroyView()
    }
  }

  override fun onDestroy() {
    try {
      (activity as? LifecycleOwner)?.lifecycle?.removeObserver(this)
      unRegisterEventBus()
      callbacks.clear()
      onExit = null
      paymentEventListener = null
    } catch (_: Exception) {
    } finally {
      super<Fragment>.onDestroy()
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

  /** Hardware back for this surface: JS decides, the host falls back to the Activity's handler. */
  fun onBackPressed(): Boolean =
    try {
      ReactNativeController.getReactHost().onBackPressed()
    } catch (_: Exception) {
      false
    }

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

    /* Same argument keys androidx's ReactFragment uses, so existing bundle
       assemblers keep working. */
    private const val ARG_COMPONENT_NAME = "arg_component_name"
    private const val ARG_LAUNCH_OPTIONS = "arg_launch_options"
    private const val ARG_FABRIC_ENABLED = "arg_fabric_enabled"
  }
}
