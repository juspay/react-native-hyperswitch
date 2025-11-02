package com.hyperswitchtrident3ds

import `in`.juspay.trident.core.ConfigParameters
import `in`.juspay.trident.data.ChallengeParameters

class HsTridentConfigurator {
  companion object {

    lateinit var configParams: ConfigParameters

    @JvmStatic
    fun setConfigParameters() {
      configParams = ConfigParameters()
    }

    @JvmStatic
    fun getChallengeParams(
      acsRefNumber: String,
      acsSignedContent: String,
      acsTransactionId: String,
      threeDSRequestorAppURL: String?,
      threeDSServerTransID: String,
    ): ChallengeParameters {
      return ChallengeParameters(
        threeDSServerTransactionID = threeDSServerTransID,
        acsTransactionID = acsTransactionId,
        acsRefNumber = acsRefNumber,
        acsSignedContent = acsSignedContent
      ).apply {
        threeDSRequestorAppURL?.let { this.threeDSRequestorAppURL = it }
      }
    }
  }
}
