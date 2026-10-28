package com.hyperswitchairborne

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import io.hyperswitch.airborne.AirborneOTA

/**
 * React Native Module providing access to Hyperswitch Airborne Over-The-Air (OTA) updates.
 *
 * Implements native integration with io.hyperswitch.airborne.AirborneOTA.
 */
class HyperswitchAirborneModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var airborneOTA: AirborneOTA? = null

  override fun getName(): String {
    return NAME
  }

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(true)
  }

  @ReactMethod
  fun getBundlePath(promise: Promise) {
    try {
      val path = airborneOTA?.getBundlePath() ?: "assets://hyperswitch.bundle"
      promise.resolve(path)
    } catch (e: Exception) {
      promise.reject("AIRBORNE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun initialize(baseUrl: String, sdkVersion: String, promise: Promise) {
    try {
      airborneOTA = AirborneOTA(reactApplicationContext, sdkVersion, baseUrl)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("AIRBORNE_INIT_ERROR", e.message, e)
    }
  }

  companion object {
    const val NAME = "HyperswitchAirborne"
  }
}
