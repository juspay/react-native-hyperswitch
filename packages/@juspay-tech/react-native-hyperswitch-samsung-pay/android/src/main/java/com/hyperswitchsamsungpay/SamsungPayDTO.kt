package com.hyperswitchsamsungpay

import org.json.JSONArray

data class Amount(
  val option: String,
  val currencyCode: String,
  val total: String
)

data class Merchant(
  val name: String,
  val url: String,
  val currencyCode: String
)

data class SamsungPayDTO(
  val serviceId: String,
  val orderNo: String,
  val merchant: Merchant,
  val amount: Amount,
  val protocol: String,
  val allowedCardBrands: JSONArray,
  val billingAddressRequired: Boolean,
  val shippingAddressRequired: Boolean

)

data class CustomerBillingInfo(
  val firstName: String,
  val lastName: String,
  val email: String
)


data class PaymentDetails(
  val country: String,
  val city: String,
  val state: String,
  val line1: String,
  val line2: String?,
  val zip: String,
  val firstName: String,
  val lastName: String,
  val email: String
) {
  fun toJson(): String {
    return """
            {
                "country": "$country",
                "city": "$city",
                "state": "$state",
                "line1": "$line1",
                "line2": "$line2",
                "zip": "$zip",
                "first_name": "$firstName",
                "last_name": "$lastName",
                "email": "$email"
            }
        """.trimIndent().replace("\n", "").replace("\r", "")
  }
}

class PaymentDetailsBuilder {
  private var country: String = ""
  private var city: String = ""
  private var state: String = ""
  private var line1: String = ""
  private var line2: String? = null
  private var zip: String = ""
  private var firstName: String = ""
  private var lastName: String = ""
  private var email: String = ""

  fun country(country: String) = apply { this.country = country }
  fun city(city: String) = apply { this.city = city }
  fun state(state: String) = apply { this.state = state }
  fun line1(line1: String) = apply { this.line1 = line1 }
  fun line2(line2: String?) = apply { this.line2 = line2 }
  fun zip(zip: String) = apply { this.zip = zip }
  fun firstName(firstName: String) = apply { this.firstName = firstName }
  fun lastName(lastName: String) = apply { this.lastName = lastName }
  fun email(email: String) = apply { this.email = email }

  fun build(): PaymentDetails {
    return PaymentDetails(country, city, state, line1, line2, zip, firstName, lastName, email)
  }
}

