package com.juspaytech.reactnativehyperswitchpaypal

import com.facebook.react.uimanager.ThemedReactContext
import com.paypal.android.paymentbuttons.PayPalButtonColor
import com.paypal.android.paymentbuttons.PayPalButtonLabel
import com.paypal.android.paymentbuttons.PaymentButtonSize

object PaypalButtonViewManagerImpl {
  const val NAME = "PaypalButton"

  fun createViewInstance(context: ThemedReactContext): PaypalButtonView {
    return PaypalButtonView(context)
  }

  fun onAfterUpdateTransaction(view: PaypalButtonView) {
    view.addButton()
  }

  fun setButtonColor(view: PaypalButtonView, value: String?) {
    view.buttonColor = when (value) {
      "GOLD" -> PayPalButtonColor.GOLD
      "BLUE" -> PayPalButtonColor.BLUE
      "SILVER" -> PayPalButtonColor.SILVER
      "WHITE" -> PayPalButtonColor.WHITE
      "BLACK" -> PayPalButtonColor.BLACK
      else -> PayPalButtonColor.GOLD
    }
  }

  fun setButtonLabel(view: PaypalButtonView, value: String?) {
    view.buttonLabel = when (value) {
      "CHECKOUT" -> PayPalButtonLabel.CHECKOUT
      "BUY_NOW" -> PayPalButtonLabel.BUY_NOW
      "PAY" -> PayPalButtonLabel.PAY
      else -> PayPalButtonLabel.PAYPAL
    }
  }

  fun setButtonSize(view: PaypalButtonView, value: String?) {
    view.buttonSize = when (value) {
      "SMALL" -> PaymentButtonSize.SMALL
      "LARGE" -> PaymentButtonSize.LARGE
      else -> PaymentButtonSize.MEDIUM
    }
  }

  fun setBorderRadius(view: PaypalButtonView, value: Double) {
    view.customCornerRadius = value.toFloat()
  }
}
