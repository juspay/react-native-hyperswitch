package com.hyperswitchtrident3ds

import android.app.Activity
import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import `in`.juspay.trident.core.FileHelper
import `in`.juspay.trident.core.Logger
import `in`.juspay.trident.core.SdkHelper
import `in`.juspay.trident.core.ThreeDS2Service
import `in`.juspay.trident.core.Transaction
import `in`.juspay.trident.data.ChallengeParameters
import `in`.juspay.trident.data.AuthenticationRequestParameters
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import `in`.juspay.trident.core.ThreeDS2Service.Companion.getDirectoryServerId


class HsTridentUtils {
  private var  threeDS2Service: ThreeDS2Service
  private lateinit var challengeParameters: ChallengeParameters
  private lateinit var transaction: Transaction
  private var aReq: AuthenticationRequestParameters? = null

  val sdkHelper = object : SdkHelper {
    override val logger = object : Logger {
      override fun addLogToPersistedQueue(logLine: JSONObject) {
        // println("Log: $logLine")
      }

      override fun track(logLine: JSONObject) {
        // println("Log: $logLine")
      }
    }
    override val fileHelper = object : FileHelper {
      override fun renewFile(endpoint: String, fileName: String, startTime: Long) {
      }
      override fun readFromFile(fileName: String): String {
        return fileName
      }
    }

  }


  init{
    threeDS2Service = ThreeDS2Service.createNewInstance(sdkHelper)
  }

  fun setChallengeParameter(challengeParameters: ChallengeParameters, callback: Callback) {
    this.challengeParameters = challengeParameters

    val map = Arguments.createMap();
    if (challengeParameters != null) {
      map.putString("status", "success")
      map.putString("message", "challenge params receive successful")
      callback.invoke(map)
    } else {
      map.putString("status", "failure")
      map.putString("message", "challenge params receive failure")
      callback.invoke(map)
    }

  }

  fun initialiseTridentSDK(context: Context, callback: Callback) {
    val map = Arguments.createMap()
    try {
      HsTridentConfigurator.setConfigParameters()
      threeDS2Service.initialise(context,HsTridentConfigurator.configParams, "en-US", null)
      map.putString("status", "success")
      map.putString("message", "Trident SDK initialization successful")
      callback.invoke(map)
    } catch (throwable: Throwable) {
      if (throwable.message?.contains("ThreeDS2Service is already initialized") == true) {
        map.putString("status", "success")
        map.putString("message", "Trident SDK already initialized")
        callback.invoke(map)
      } else {
        map.putString("status", "failure")
        map.putString(
          "message",
          "Trident SDK initialization failed: " + throwable.message.toString()
        )
        callback.invoke(map)
      }
    }
  }

  fun generateAReqParams(activity: Activity?, messageVersion: String, directoryServerId: String, cardNetwork:String, rnCallback: Callback) {
    val outerStatusMapForError = Arguments.createMap()

    try {
      threeDS2Service.createTransaction(
        directoryServerID = getDirectoryServerId(cardNetwork),
        messageVersion = messageVersion,
        onTransaction = { sdkTransaction ->
          this.transaction = sdkTransaction
          this.aReq = sdkTransaction.getAuthenticationRequestParameters()
          try {
            if (this.aReq == null) {
              val errorMap = Arguments.createMap()
              errorMap.putString("status", "error")
              errorMap.putString("message", "AReq Params were null after SDK transaction callback.")
              rnCallback.invoke(errorMap)
              return@createTransaction
            }

            val authRequestParams = this.aReq!!

            val aReqMap = Arguments.createMap()
            aReqMap.putString("deviceData", authRequestParams.deviceData)
            aReqMap.putString("messageVersion", authRequestParams.messageVersion)
            aReqMap.putString("sdkTransId", authRequestParams.sdkTransactionID)
            aReqMap.putString("sdkAppId", authRequestParams.sdkAppID)
            aReqMap.putString("sdkEphemeralKey", authRequestParams.sdkEphemeralPublicKey)
            aReqMap.putString("sdkReferenceNo", authRequestParams.sdkReferenceNumber)

            val successStatusMap = Arguments.createMap()
            successStatusMap.putString("status", "success")
            successStatusMap.putString("message", "AReq Params generation successful")

            rnCallback.invoke(successStatusMap,aReqMap)
          } catch (innerErr: Exception) {
            val errorMap = Arguments.createMap()
            errorMap.putString("status", "error")
            errorMap.putString("message", "AReq Params processing failure in SDK callback: " + innerErr.message)
            rnCallback.invoke(errorMap)
          }
        }
      )
    } catch (err: Exception) {
      outerStatusMapForError.putString("status", "error")
      if (err is `in`.juspay.trident.exception.InvalidInputException && err.message?.contains("Directory Server Id", ignoreCase = true) == true) {
        outerStatusMapForError.putString("message", "createTransaction failed: Invalid Directory Server ID ('$directoryServerId') or Message Version ('$messageVersion'). SDK error: ${err.message}")
      } else {
        outerStatusMapForError.putString("message", "createTransaction call failed: " + err.message)
      }
      rnCallback.invoke(outerStatusMapForError)
    }
  }
  fun generateChallenge(activity: Activity?, timeOut: Int, callback: Callback) {
    val challengeStatusReceiver = HsChallengeManager(callback)

    CoroutineScope(Dispatchers.IO).launch {
      withContext(Dispatchers.Main) {
        try {
          if(activity!=null) {
            transaction.doChallenge(
              activity,
              challengeParameters,
              challengeStatusReceiver,
              timeOut,
              "{}"
            )
          } else {
            val statusMap = Arguments.createMap()
            statusMap.putString("status", "error")
            statusMap.putString("message", "Activity instance not found")
            callback.invoke(statusMap)
          }
        } catch (err: Exception) {
          val statusMap = Arguments.createMap()
          statusMap.putString("status", "error")
          statusMap.putString("message", "Challenge generation failure: " + err.message)
          callback.invoke(statusMap)
        }
      }
    }
  }
}
