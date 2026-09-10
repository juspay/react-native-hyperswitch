package io.hyperswitch.googlepay

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.HyperGooglePayButtonManagerDelegate
import com.facebook.react.viewmanagers.HyperGooglePayButtonManagerInterface

@ReactModule(name = HyperGooglePayButtonManager.REACT_CLASS)
class HyperGooglePayButtonManager :
  SimpleViewManager<HyperGooglePayButtonView>(),
  HyperGooglePayButtonManagerInterface<HyperGooglePayButtonView> {
  private val delegate = HyperGooglePayButtonManagerDelegate(this)

  override fun getName() = REACT_CLASS

  override fun getDelegate() = delegate

  override fun createViewInstance(reactContext: ThemedReactContext): HyperGooglePayButtonView =
    HyperGooglePayButtonView(reactContext)

  override fun onAfterUpdateTransaction(view: HyperGooglePayButtonView) {
    super.onAfterUpdateTransaction(view)
    view.initialize()
  }

  @ReactProp(name = "type")
  override fun setType(view: HyperGooglePayButtonView, buttonType: Int) {
    view.setType(buttonType)
  }

  @ReactProp(name = "appearance")
  override fun setAppearance(view: HyperGooglePayButtonView, appearance: Int) {
    view.setAppearance(appearance)
  }

  @ReactProp(name = "borderRadius")
  override fun setBorderRadius(view: HyperGooglePayButtonView, borderRadius: Int) {
    view.setBorderRadius(borderRadius)
  }

  companion object {
    const val REACT_CLASS = "HyperGooglePayButton"
  }
}
