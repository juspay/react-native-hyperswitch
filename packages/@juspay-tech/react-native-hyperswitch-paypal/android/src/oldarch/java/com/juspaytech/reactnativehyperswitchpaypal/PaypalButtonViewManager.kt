package com.juspaytech.reactnativehyperswitchpaypal

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

@ReactModule(name = PaypalButtonViewManagerImpl.NAME)
class PaypalButtonViewManager : SimpleViewManager<PaypalButtonView>() {

  override fun getName(): String {
    return PaypalButtonViewManagerImpl.NAME
  }

  public override fun createViewInstance(context: ThemedReactContext): PaypalButtonView {
    return PaypalButtonViewManagerImpl.createViewInstance(context)
  }

  public override fun onAfterUpdateTransaction(view: PaypalButtonView) {
    super.onAfterUpdateTransaction(view)
    PaypalButtonViewManagerImpl.onAfterUpdateTransaction(view)
  }

  @ReactProp(name = "buttonColor")
  fun setButtonColor(view: PaypalButtonView, value: String?) {
    PaypalButtonViewManagerImpl.setButtonColor(view, value)
  }

  @ReactProp(name = "buttonLabel")
  fun setButtonLabel(view: PaypalButtonView, value: String?) {
    PaypalButtonViewManagerImpl.setButtonLabel(view, value)
  }

  @ReactProp(name = "buttonSize")
  fun setButtonSize(view: PaypalButtonView, value: String?) {
    PaypalButtonViewManagerImpl.setButtonSize(view, value)
  }

  @ReactProp(name = "borderRadius", defaultDouble = 0.0)
  fun setBorderRadius(view: PaypalButtonView, value: Double) {
    PaypalButtonViewManagerImpl.setBorderRadius(view, value)
  }
}
