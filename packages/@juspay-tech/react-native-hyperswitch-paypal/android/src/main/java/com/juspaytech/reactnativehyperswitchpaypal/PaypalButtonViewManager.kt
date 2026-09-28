package com.juspaytech.reactnativehyperswitchpaypal

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.PaypalButtonManagerDelegate
import com.facebook.react.viewmanagers.PaypalButtonManagerInterface

@ReactModule(name = PaypalButtonViewManagerImpl.NAME)
class PaypalButtonViewManager :
  SimpleViewManager<PaypalButtonView>(),
  PaypalButtonManagerInterface<PaypalButtonView> {

  private val delegate: ViewManagerDelegate<PaypalButtonView> =
    PaypalButtonManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<PaypalButtonView> {
    return delegate
  }

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
  override fun setButtonColor(view: PaypalButtonView, value: String?) {
    PaypalButtonViewManagerImpl.setButtonColor(view, value)
  }

  @ReactProp(name = "buttonLabel")
  override fun setButtonLabel(view: PaypalButtonView, value: String?) {
    PaypalButtonViewManagerImpl.setButtonLabel(view, value)
  }

  @ReactProp(name = "buttonSize")
  override fun setButtonSize(view: PaypalButtonView, value: String?) {
    PaypalButtonViewManagerImpl.setButtonSize(view, value)
  }

  @ReactProp(name = "borderRadius", defaultDouble = 0.0)
  override fun setBorderRadius(view: PaypalButtonView, value: Double) {
    PaypalButtonViewManagerImpl.setBorderRadius(view, value)
  }
}
