package com.hyperswitchsamsungpay

import com.hyperswitchsamsungpay.SamsungPayController.Companion.paymentManager
import com.samsung.android.sdk.samsungpay.v2.payment.CustomSheetPaymentInfo
import com.samsung.android.sdk.samsungpay.v2.payment.sheet.AddressControl
import com.samsung.android.sdk.samsungpay.v2.payment.sheet.AmountBoxControl
import com.samsung.android.sdk.samsungpay.v2.payment.sheet.AmountConstants
import com.samsung.android.sdk.samsungpay.v2.payment.sheet.CustomSheet
import com.samsung.android.sdk.samsungpay.v2.payment.sheet.SheetItemType
import com.samsung.android.sdk.samsungpay.v2.payment.sheet.SheetUpdatedListener
import java.util.Locale

class SPaySheetControlUtils {


  companion object {
    private const val BILLING_CONTROL_ID = "BILLING_CONTROL_ID"
    private const val SHIPPING_CONTROL_ID = "SHIPPING_CONTROL_ID"

    @JvmStatic
    fun makeAmountControl(amount: Amount): AmountBoxControl {
      val amountBoxControl = AmountBoxControl(amount.option, amount.currencyCode)
      amountBoxControl.setAmountTotal(
        amount.total.toDouble(), AmountConstants.FORMAT_TOTAL_PRICE_ONLY
      )
      return amountBoxControl
    }

    @JvmStatic
    fun makeBillingAddressControl(
      amountBoxControl: AmountBoxControl
    ): AddressControl {
      val billingAddressControl = AddressControl(BILLING_CONTROL_ID, SheetItemType.BILLING_ADDRESS)
      billingAddressControl.addressTitle = "Billing Address"

      billingAddressControl.sheetUpdatedListener = billingSheetUpdatedListener(amountBoxControl)
      return billingAddressControl
    }


    @JvmStatic
    fun makeShippingAddressControl(
      amountBoxControl: AmountBoxControl
    ): AddressControl {
      val billingAddressControl =
        AddressControl(SHIPPING_CONTROL_ID, SheetItemType.SHIPPING_ADDRESS)
      billingAddressControl.addressTitle = "Shipping Address"

      billingAddressControl.sheetUpdatedListener = shippingSheetUpdatedListener(amountBoxControl)
      return billingAddressControl
    }


    fun parseName(fullName: String): Pair<String, String> {
      val parts = fullName.trim().split(" ")
      val firstName = parts.getOrNull(0) ?: ""
      val lastName = parts.getOrNull(1) ?: ""
      return Pair(firstName, lastName)
    }


    private fun shippingSheetUpdatedListener(amountBoxControl: AmountBoxControl): SheetUpdatedListener? {
      return SheetUpdatedListener { updatedControlId: String, customSheet: CustomSheet ->
        run {

          val addressControl = customSheet.getSheetControl(updatedControlId)
          val a = addressControl as? AddressControl
          customSheet.updateControl(amountBoxControl)
          customSheet.updateControl(a!!)


          val fullName = addressControl.address.addressee
          val (firstName, lastName) = parseName(fullName)

          val email = addressControl.address.email

          SamsungPayController.customerBillingInfo = CustomerBillingInfo(firstName, lastName, email)

          SamsungPayController.billingDetailsCollectedFromSPay.firstName(firstName)
            .lastName(lastName).email(email)

          try {
            paymentManager.updateSheet(customSheet)
          } catch (e: java.lang.IllegalStateException) {
            e.printStackTrace()
          } catch (e: java.lang.NullPointerException) {
            e.printStackTrace()
          }

        }
      }
    }


    private fun billingSheetUpdatedListener(amountBoxControl: AmountBoxControl): SheetUpdatedListener? {
      return SheetUpdatedListener { updatedControlId: String, customSheet: CustomSheet ->
        run {

          val addressControl = customSheet.getSheetControl(updatedControlId)
          val a = addressControl as? AddressControl
          customSheet.updateControl(amountBoxControl)
          customSheet.updateControl(a!!)

          val address = addressControl.address

          val iso2CountryCode = convertIsoAlpha3ToAlpha2(address.countryCode)
          SamsungPayController.billingDetailsCollectedFromSPay =
            PaymentDetailsBuilder().country(iso2CountryCode).line1(address.addressLine1)
              .line2(address.addressLine2).state(address.state).zip(address.postalCode)
              .city(address.city)


          try {
            paymentManager.updateSheet(customSheet)
          } catch (e: java.lang.IllegalStateException) {
            e.printStackTrace()
          } catch (e: java.lang.NullPointerException) {
            e.printStackTrace()
          }

        }
      }
    }

    public fun convertIsoAlpha3ToAlpha2(alpha3: String): String {
      for (countryCode in Locale.getISOCountries()) {
        val locale = Locale("", countryCode)
        // Compare ignoring case to be more flexible
        if (locale.isO3Country.equals(alpha3, ignoreCase = true)) {
          return locale.country  // This is the two-letter code
        }
      }
      return ""
    }


    public fun getShippingAddressJson(address: CustomSheetPaymentInfo.Address):String{
      val (shippingFirstName, shippingLastName) = SPaySheetControlUtils.parseName(
        address.addressee
      )
      val shippindDetails =
        PaymentDetailsBuilder().firstName(shippingFirstName)
          .lastName(shippingLastName).city(address.city)
          .country(convertIsoAlpha3ToAlpha2(address.countryCode))
          .line1(address.addressLine1)
          .line2(address.addressLine2)
          .zip(address.postalCode)
          .email(address.email)
          .state(address.state).build().toJson()

      return shippindDetails
    }


  }
}
