package com.hyperswitchsdkreactnative.modules

import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType
import com.hyperswitchsdkreactnative.BuildConfig
import com.hyperswitchsdkreactnative.NativeWidgetHelperModuleSpec
import io.hyperswitch.utils.StandardResult
import io.hyperswitch.view.PaymentWidgetView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

class NativeWidgetHelperModule(private val reactContext: ReactApplicationContext) :
  NativeWidgetHelperModuleSpec(reactContext) {

  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
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

  override fun confirmPayment(
    reactTag: Double,
    callback: Callback
  ) {
    UiThreadUtil.runOnUiThread {
      val uiManagerModule =
        UIManagerHelper.getUIManager(
          reactContext,
          uiManagerType
        )
      try {
        val view = uiManagerModule?.resolveView(reactTag.toInt())
        val element = resolveHyperswitchElement(view)
        if (element != null) {
          element.confirmPayment { result ->
            callback.invoke(result)
          }
        } else {
          callback.invoke("ERROR", "Invalid view type")
        }
      } catch (e: Exception) {
        callback.invoke("ERROR", "View not found: ${e.message}")
      }
    }
  }

  override fun updateIntentInitForWidget(
    reactTag: Double,
    callback: Callback
  ) {
    UiThreadUtil.runOnUiThread {
      val uiManagerModule =
        UIManagerHelper.getUIManager(
          reactApplicationContext,
          uiManagerType
        )
      try {
        val view = uiManagerModule?.resolveView(reactTag.toInt())
        val element = resolveHyperswitchElement(view)
        if (element != null) {
          element.updatePaymentIntentInit {
            callback.invoke(Arguments.createMap().apply { putString("status", "success") })
          }
        } else {
          callback.invoke("ERROR", "Invalid view type")
        }
      } catch (e: Exception) {
        callback.invoke("ERROR", "View not found: ${e.message}")
      }
    }
  }

  override fun updateIntentCompleteForWidget(
    reactTag: Double,
    sdkAuthorization: String,
    callback: Callback
  ) {
    UiThreadUtil.runOnUiThread {
      val uiManagerModule =
        UIManagerHelper.getUIManager(
          reactContext,
          uiManagerType
        )
      try {
        val view = uiManagerModule?.resolveView(reactTag.toInt())
        val element = resolveHyperswitchElement(view)
        if (element != null) {
          try {
            element.updatePaymentIntentComplete(
              sdkAuthorization
            ) { it ->
              callback.invoke(it)
            }
          } catch (e: Exception) {
            callback.invoke("ERROR", "updateIntentComplete failed: ${e.message}")
          }
        } else {
          callback.invoke("ERROR", "Invalid view type")
        }
      } catch (e: Exception) {
        callback.invoke("ERROR", "View not found: ${e.message}")
      }
    }
  }


  /**
   * Destroys the native widget instance(s) cached for the given
   * sdkAuthorization (the key widgets are stored under). Hosting views stay
   * mounted and re-create a fresh widget on demand (next prop update / attach).
   */
  override fun deinitWidget(
    sdkAuthorization: String,
    callback: Callback
  ) {
    UiThreadUtil.runOnUiThread {
      try {
        val count = PaymentWidgetView.deinitWidgetsForSdkAuthorization(sdkAuthorization)
        callback.invoke(
          if (count > 0) {
            StandardResult.Success(message = "Deinitialised $count widget(s)").toJSONString()
          } else {
            StandardResult.Failed(
              code = "WIDGET_NOT_FOUND",
              message = "No widget found for the given sdkAuthorization"
            ).toJSONString()
          }
        )
      } catch (e: Exception) {
        callback.invoke(
          StandardResult.Failed(
            code = "DEINIT_FAILED",
            message = e.message ?: "deinitWidget failed"
          ).toJSONString()
        )
      }
    }
  }


  private fun resolveHyperswitchElement(view: View?): PaymentWidgetView? {
    if (view == null) return null
    if (view is PaymentWidgetView) return view
    if (view is ViewGroup) {
      try {
        return view.getChildAt(0) as PaymentWidgetView?
      } catch (_: Exception) {
        for (i in 0 until view.childCount) {
          val child = view.getChildAt(i)
          resolveHyperswitchElement(child)?.let {
            return it
          }
        }
      }
    }
    return null
  }

  companion object {
    const val NAME = "NativeWidgetHelperModule"
  }
}
