package com.reactnativehyperswitchnetcetera3ds

import android.app.Application
import com.netcetera.threeds.sdk.api.configparameters.ConfigParameters
import com.netcetera.threeds.sdk.api.configparameters.builder.ConfigurationBuilder
import com.netcetera.threeds.sdk.api.configparameters.builder.SchemeConfiguration
import com.netcetera.threeds.sdk.api.transaction.challenge.ChallengeParameters

class HsNetceteraConfigurator {
  companion object {
    lateinit var configParams: ConfigParameters
    lateinit var hsSDKEnviroment: HsSDKEnviroment

    @JvmStatic
    fun setConfigParameters(
      application: Application, hsSDKEnvironment: HsSDKEnviroment, apiKey: String
    ) {
      val assetManager = application.assets
      var configParamsBuilder: ConfigurationBuilder = ConfigurationBuilder().apiKey(apiKey)
      this.hsSDKEnviroment = hsSDKEnvironment

      if (hsSDKEnvironment == HsSDKEnviroment.SANDBOX || hsSDKEnvironment == HsSDKEnviroment.INTEG) {
        configParamsBuilder.configureScheme(
          SchemeConfiguration.mastercardSchemeConfiguration()
            .rootPublicKeyFromAssetCertificate(assetManager, "nca_demo_root.crt").build()
        ).configureScheme(
          SchemeConfiguration.visaSchemeConfiguration()
            .rootPublicKeyFromAssetCertificate(assetManager, "nca_demo_root.crt").build()
        ).configureScheme(
          SchemeConfiguration.amexConfiguration()
            .rootPublicKeyFromAssetCertificate(assetManager, "nca_demo_root.crt").build()
        ).configureScheme(
          SchemeConfiguration.dinersSchemeConfiguration()
            .rootPublicKeyFromAssetCertificate(assetManager, "nca_demo_root.crt").build()
        ).configureScheme(
          SchemeConfiguration.unionSchemeConfiguration()
            .rootPublicKeyFromAssetCertificate(assetManager, "nca_demo_root.crt").build()
        ).configureScheme(
          SchemeConfiguration.jcbConfiguration()
            .rootPublicKeyFromAssetCertificate(assetManager, "nca_demo_root.crt").build()
        ).configureScheme(
          SchemeConfiguration.eftposConfiguration()
            .rootPublicKeyFromAssetCertificate(assetManager, "nca_demo_root.crt").build()
        )
      }

      configParams = configParamsBuilder.build()
    }

    @JvmStatic
    fun getChallengeParams(
      acsRefNumber: String,
      acsSignedContent: String,
      acsTransactionId: String,
      threeDSRequestorAppURL: String?,
      threeDSServerTransID: String,
    ): ChallengeParameters {
      val challengeParameters = ChallengeParameters().apply {
        set3DSServerTransactionID(threeDSServerTransID)
        setAcsRefNumber(acsRefNumber)
        setAcsSignedContent(acsSignedContent)
        this.acsRefNumber = acsRefNumber
        this.acsTransactionID = acsTransactionId
        threeDSRequestorAppURL?.let { this.threeDSRequestorAppURL = it }
      }

      return challengeParameters
    }
  }
}
