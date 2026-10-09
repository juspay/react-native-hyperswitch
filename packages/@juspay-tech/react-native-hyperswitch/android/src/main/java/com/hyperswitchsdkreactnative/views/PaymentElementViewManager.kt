package com.hyperswitchsdkreactnative.views

import android.app.Activity
import android.view.View.MeasureSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Dynamic
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.common.UIManagerType
import com.facebook.react.uimanager.events.Event
import com.facebook.react.viewmanagers.NativePaymentWidgetManagerInterface
import com.facebook.react.viewmanagers.NativePaymentWidgetManagerDelegate
import com.hyperswitchsdkreactnative.BuildConfig
import com.hyperswitchsdkreactnative.model.PaymentWidgetEvent
import com.hyperswitchsdkreactnative.model.PaymentWidgetResult
import io.hyperswitch.PaymentEvent
import io.hyperswitch.PaymentEventListener
import io.hyperswitch.view.PaymentResultListener
import io.hyperswitch.view.PaymentWidgetView

class PaymentElementViewManager : SimpleViewManager<PaymentWidgetView>(),
  NativePaymentWidgetManagerInterface<PaymentWidgetView> {

  private val mDelegate: ViewManagerDelegate<PaymentWidgetView> =
    NativePaymentWidgetManagerDelegate(this)

  override fun getName(): String = NAME

  val uiManagerType = if( BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
    UIManagerType.FABRIC
  }else{
    UIManagerType.DEFAULT
  }

  override fun getDelegate(): ViewManagerDelegate<PaymentWidgetView> {
    return mDelegate
  }

  private var context: ReactApplicationContext? = null
  private var reactContext : ReactContext? = null
  override fun createViewInstance(reactContext: ThemedReactContext): PaymentWidgetView {
    this.reactContext = reactContext
    context = reactContext.reactApplicationContext
    return NativeWidgetContainer(context?.currentActivity).apply {
      onEvent(object : PaymentEventListener {
        override fun onPaymentEvent(event: PaymentEvent) {
          emitOnPaymentEvent(this@apply, event)
        }
      })
      onPaymentResult(object : PaymentResultListener {
        override fun onPaymentResult(result: String) {
          emitOnPaymentResult(this@apply, result)
        }
      })
    }
  }

  override fun onAfterUpdateTransaction(container: PaymentWidgetView) {
    super.onAfterUpdateTransaction(container)

  }

  @ReactProp(name = "widgetType")
  override fun setWidgetType(container: PaymentWidgetView, widgetType: String?) {
    container.setWidgetType(widgetType)
  }

  @ReactProp(name = "sdkAuthorization")
  override fun setSdkAuthorization(container: PaymentWidgetView, sdkAuthorization: String?) {
    sdkAuthorization?.let {
      container.setSdkAuthorization(sdkAuthorization)
    }
  }

  @ReactProp(name = "options")
  override fun setOptions(container: PaymentWidgetView, options: Dynamic?) {
    options?.asMap()?.let {
      container.setConfiguration(it)
      // The widget's session (client-core's HyperswitchElement.bind); JS scopes updateIntent by its tag.
      container.bindSession(if (it.hasKey("sessionTag") && !it.isNull("sessionTag")) it.getInt("sessionTag") else null)
    }
  }

  private fun emitOnPaymentResult(
    container: PaymentWidgetView,
    result: String
  ){
    if(reactContext != null) {
      val surfaceId = UIManagerHelper.getSurfaceId(container)

      reactContext?.let { it ->
        UIManagerHelper.getEventDispatcher(it, uiManagerType)
          ?.dispatchEvent(PaymentWidgetResult(surfaceId, container.id, result))
      }
    }
  }


  private fun emitOnPaymentEvent(
    container: PaymentWidgetView,
    event: PaymentEvent
  ) {
    if(reactContext != null) {
        val surfaceId = UIManagerHelper.getSurfaceId(container)

        reactContext?.let { it ->
          UIManagerHelper.getEventDispatcher(it, uiManagerType)
            ?.dispatchEvent(PaymentWidgetEvent(surfaceId, container.id, event))
        }
    }
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
    return mutableMapOf(
      EVENT_ON_PAYMENT to mutableMapOf<String, Any>(
        "registrationName" to EVENT_ON_PAYMENT
      ),
      ON_PAYMENT_RESULT to mutableMapOf(
        "registrationName" to ON_PAYMENT_RESULT
      )
    )
  }

  private class NativeWidgetContainer(activity: Activity?) : PaymentWidgetView(activity!!) {
    override fun requestLayout() {
      super.requestLayout()
      post(measureAndLayout)
    }

    private val measureAndLayout = Runnable {
      measure(
        MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
      )
      layout(left, top, right, bottom)
    }
  }

  companion object {
    const val NAME = "RCTNativePaymentWidget"
    const val EVENT_ON_PAYMENT = "onPaymentEvent"
    const val ON_PAYMENT_RESULT = "onPaymentResult"
  }
}
