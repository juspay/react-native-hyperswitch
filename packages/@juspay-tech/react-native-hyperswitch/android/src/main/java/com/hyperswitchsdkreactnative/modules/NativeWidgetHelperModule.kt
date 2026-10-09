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
          // client-core's HyperswitchElement.confirmPayment: refuse while the session updates its
          // intent, otherwise confirm with the session's current credentials.
          val session = (reactContext.getNativeModule(ReactNativeHyperswitchModule.NAME)
            as? ReactNativeHyperswitchModule)?.session(element.getSessionTag())
          if (session?.isUpdatingIntent == true) {
            callback.invoke(
              StandardResult.Failed(
                code = "UPDATE_IN_PROGRESS",
                error = Throwable("An intent update is in progress; confirm after it completes").apply {
                  initCause(Throwable("UPDATE_IN_PROGRESS"))
                }
              ).toJSONString()
            )
          } else {
            session?.sessionConfig?.let { element.setSdkAuthorization(it.sdkAuthorization) }
            element.confirmPayment { result ->
              callback.invoke(result)
            }
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
