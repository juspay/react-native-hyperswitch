package com.hyperswitchsdkreactnative.modules

import android.content.res.Configuration
import com.facebook.react.common.LifecycleState
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import io.hyperswitch.logs.EventName
import io.hyperswitch.logs.HSLog
import io.hyperswitch.logs.HyperLogManager
import io.hyperswitch.logs.LogCategory
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * Native SDK lifecycle logs sent through HyperLogManager. Same shape as the iOS `NativeLog`:
 *  - event_name        RN_SDK_LIFE_CYCLE
 *  - value             a stable snake_case event id (filterable, no variable data)
 *  - internal_metadata a JSON object with the event's details plus app_state and orientation
 *  - source            "native"
 *
 * [enabled] is set from the module once the logging endpoint is known. Never throws, so logging
 * cannot break a payment flow. addLog runs on the UI thread because the logger keeps an
 * unsynchronised batch that its debouncer reads on the main looper.
 */
object NativeLog {
  private const val SOURCE = "native"

  @Volatile
  var enabled = false

  private var reactContext: WeakReference<ReactApplicationContext>? = null

  /** Lets every log carry app_state and orientation, as on iOS. */
  fun attach(context: ReactApplicationContext) {
    reactContext = WeakReference(context)
  }

  private fun context(): Map<String, Any?> {
    val ctx = reactContext?.get()
    val appState = when (ctx?.lifecycleState) {
      LifecycleState.RESUMED -> "active"
      LifecycleState.BEFORE_RESUME -> "inactive"
      LifecycleState.BEFORE_CREATE -> "background"
      null -> "unknown"
    }
    val orientation = when (ctx?.resources?.configuration?.orientation) {
      Configuration.ORIENTATION_PORTRAIT -> "portrait"
      Configuration.ORIENTATION_LANDSCAPE -> "landscape"
      else -> "unknown"
    }
    return mapOf("app_state" to appState, "orientation" to orientation)
  }

  /** `production` / `sandbox` / `integ`, the same values iOS logs. */
  fun environmentName(name: String?): String? = when (name) {
    null -> null
    "PROD" -> "production"
    else -> name.lowercase()
  }

  fun debug(event: String, details: Map<String, Any?> = emptyMap()) = send("debug", event, details)
  fun warning(event: String, details: Map<String, Any?> = emptyMap()) = send("warning", event, details)
  fun error(event: String, details: Map<String, Any?> = emptyMap()) = send("error", event, details)

  fun send(logType: String, event: String, details: Map<String, Any?> = emptyMap()) {
    if (!enabled) return
    val log = runCatching {
      HSLog.LogBuilder()
        .logType(logType)
        .category(LogCategory.API)
        .eventName(EventName.RN_SDK_LIFE_CYCLE)
        .value(event)
        .internalMetadata(JSONObject((details + context()).filterValues { it != null }).toString())
        .source(SOURCE)
        .build()
    }.getOrNull() ?: return
    UiThreadUtil.runOnUiThread { runCatching { HyperLogManager.addLog(log) } }
  }
}
