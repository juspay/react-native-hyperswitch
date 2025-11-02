package io.hyperswitch.react

import kotlin.text.isNotEmpty
import kotlin.text.startsWith

enum class SDKEnvironment { SANDBOX, PROD }

class Utils {
  companion object {
    fun checkEnvironment(publishableKey: String): SDKEnvironment {
      return if (publishableKey.isNotEmpty() && publishableKey.startsWith("pk_prd_")) {
        SDKEnvironment.PROD
      } else {
        SDKEnvironment.SANDBOX
      }
    }

    fun getLoggingUrl(publishableKey: String): String {
      return if (checkEnvironment(publishableKey) == SDKEnvironment.PROD) "https://api.hyperswitch.io/logs/sdk"
      else "https://sandbox.hyperswitch.io/logs/sdk"
    }
  }
}
