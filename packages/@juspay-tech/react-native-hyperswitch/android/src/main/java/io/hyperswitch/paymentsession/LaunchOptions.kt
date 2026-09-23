package io.hyperswitch.paymentsession

import android.app.Activity
import android.content.Context
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.webkit.WebSettings
import androidx.annotation.RequiresApi
import io.hyperswitch.model.HyperswitchBaseConfiguration
import io.hyperswitch.model.PaymentSessionConfiguration
import org.json.JSONObject

/**
 * Builds the launch bundles passed into React Native / WebView layers.
 *
 * All configuration is accepted as plain [Bundle]s so this class has no dependency on
 * [hyperswitch-sdk-android-api]. Callers are responsible for converting their typed model
 * objects before passing them here (e.g. `hsConfig.toBundle()`, `config.bundle`).
 */
class LaunchOptions(
    private val context: Context? = null,
    private val sdkVersion: String,
    private val hsConfig: HyperswitchBaseConfiguration? = null,
) {

    // ── SDK params ────────────────────────────────────────────────────────────

    private fun getSdkParams(): Bundle =
        Bundle().apply {
            putString("appId", context?.packageName)
            putString("country", context?.resources?.configuration?.locales?.get(0)?.country)
            putString("user-agent", getUserAgent(context))
            putDouble("launchTime", getCurrentTime())
            putString("sdkVersion", sdkVersion)
            putString("device_model", Build.MODEL)
            putString("os_type", "android")
            putString("os_version", Build.VERSION.RELEASE)
            putString("deviceBrand", Build.BRAND)
            putString("sessionId", "")
            putBoolean("confirm", false)
            getBottomInset(context)?.let { insets ->
                putFloat("topInset", insets.top)
                putFloat("leftInset", insets.left)
                putFloat("rightInset", insets.right)
                putFloat("bottomInset", insets.bottom)
            }
        }

    private fun getSdkParamsMap(map: Map<*, *>): Map<*, *> =
        (map["sdkParams"] as? Map<*, *> ?: mutableMapOf<String, Any?>()).apply {
            plus(Pair("appId", context?.packageName))
            plus(Pair("country", context?.resources?.configuration?.locales?.get(0)?.country))
            plus(Pair("user-agent", getUserAgent(context)))
            plus(Pair("launchTime", getCurrentTime()))
            plus(Pair("sdkVersion", sdkVersion))
            plus(Pair("device_model", Build.MODEL))
            plus(Pair("os_type", "android"))
            plus(Pair("os_version", Build.VERSION.RELEASE))
            plus(Pair("deviceBrand", Build.BRAND))
            plus(Pair("sessionId", ""))
            plus(Pair("confirm", false))
            getBottomInset(context)?.let { insets ->
                plus(Pair("topInset", insets.top))
                plus(Pair("leftInset", insets.left))
                plus(Pair("rightInset", insets.right))
                plus(Pair("bottomInset", insets.bottom))
            }
        }

    // ── Payment-session bundle (headless task / payment sheet) ────────────────

    /**
     * Convenience overload — uses the [Context] supplied at construction time.
     *
     * @param sessionConfig  Serialised `PaymentSessionConfiguration` bundle.
     * @param configuration  Serialised `PaymentSheet.Configuration` bundle.
     */
    fun getBundle(
        sessionConfig: PaymentSessionConfiguration? = null,
        configuration: Bundle? = null,
        subscribedEvents: List<String> = emptyList(),
    ): Bundle = getBundle(
        type = "payment",
        sessionConfig = sessionConfig,
        configuration = configuration,
        subscribedEvents= subscribedEvents
    )

    // ── Widget bundle ─────────────────────────────────────────────────────────

    /**
     * Builds the launch bundle for native widgets (e.g. `PaymentWidgetView`).
     *
     * Custom backend / logging URLs are extracted from the nested
     * `customEndpoints.overrideEndpoints` structure inside [hsConfig].
     *
     * @param configuration  Serialised configuration bundle (already a Bundle).
     * @param sessionConfig  Serialised `PaymentSessionConfiguration` bundle.
     */
    fun getBundle(
        type: String? = "payment",
        sessionConfig: PaymentSessionConfiguration? = null,
        configuration: Bundle? = null,
        subscribedEvents: List<String> = emptyList(),
    ): Bundle = Bundle().apply {
        putBundle("props", Bundle().apply {
            putString("type", type)
            hsConfig?.let { putBundle("hyperswitchConfig", it.toBundle()) }
            sessionConfig?.let { putBundle("paymentSessionConfig", it.toBundle()) }
            val configCopy = configuration?.let { Bundle(it) }
            if (subscribedEvents.isNotEmpty()) {
                configCopy?.putStringArrayList("subscribedEvents", ArrayList(subscribedEvents))
            }
            putBundle("configuration", configCopy)
            putBundle("sdkParams", getSdkParams())
        })
    }

    // ── Map-based overload (used by React Native bridge path) ─────────────────

    fun getBundleWithHyperParams(
        readableMap: Map<*, *>,
        subscribedEvents: List<String> = emptyList(),
    ): Bundle = Bundle().apply {
        putBundle("props", toBundle(readableMap).apply {
            putBundle("sdkParams", getSdkParams())
            putStringArrayList("subscribedEvents", ArrayList(subscribedEvents))
        })
    }

    // ── JSON helpers (used by WebView / lite SDK) ─────────────────────────────

    fun getJson(
        sessionConfig: PaymentSessionConfiguration? = null,
        configuration: Bundle? = null,
    ): JSONObject = toJson(getBundle(configuration = configuration, sessionConfig = sessionConfig))

    fun getJson(configurationMap: Map<*, *>): JSONObject =
        toJson(getMapWithHyperParams(configurationMap))

    private fun getMapWithHyperParams(map: Map<*, *>): Map<*, *> = mapOf(
        "props" to map.apply {
            plus(Pair("sdkParams", getSdkParamsMap(map)))
        }
    )
    // ── Bundle / Map / JSON conversion utilities ──────────────────────────────

    fun fromBundle(bundle: Bundle): Map<*, *> {
        val map = mutableMapOf<String, Any?>()
        for (key in bundle.keySet()) {
            val value = bundle[key]
            when {
                value == null -> {}
                value.javaClass.isArray -> map[key] = value
                value is String -> map[key] = value
                value is Number -> map[key] = value as? Int ?: value.toDouble()
                value is Boolean -> map[key] = value
                value is Bundle -> map[key] = fromBundle(value)
                value is List<*> -> map[key] = fromList(value)
                else -> throw IllegalArgumentException("Could not convert ${value.javaClass}")
            }
        }
        return map
    }

    private fun fromList(list: List<*>): List<Any?> = list.map { item ->
        when (item) {
            is Bundle -> fromBundle(item)
            is List<*> -> fromList(item)
            else -> item
        }
    }

    fun toBundle(readableMap: Map<*, *>): Bundle {
        val bundle = Bundle()
        for ((key, value) in readableMap) {
            val k = key.toString()
            when (value) {
                null -> {}
                is Boolean -> bundle.putBoolean(k, value)
                is Number -> bundle.putDouble(k, value.toDouble())
                is String -> bundle.putString(k, value)
                is Map<*, *> -> bundle.putBundle(k, toBundle(value))
                is Array<*> -> bundle.putSerializable(k, value)
                is List<*> -> bundle.putSerializable(k, toSerializableArrayList(value))
                // Name the offending type — "could not convert" alone says nothing
                // about which prop or which class actually failed.
                else -> throw IllegalArgumentException(
                    "Could not convert object with key: $k (type ${value::class.java.name}, value=$value)."
                )
            }
        }
        return bundle
    }

    private fun toSerializableArrayList(list: List<*>): ArrayList<Any?> =
        ArrayList(list.map { item ->
            when (item) {
                is Map<*, *> -> toBundle(item)
                is List<*> -> toSerializableArrayList(item)
                else -> item
            }
        })

    private fun toJson(bundle: Bundle): JSONObject {
        val json = JSONObject()
        for (key in bundle.keySet()) {
            when (val value = bundle[key]) {
                null -> {}
                is Bundle -> json.put(key, toJson(value))
                is Boolean, is Int, is Float, is Long, is Double, is String -> json.put(key, value)
                is Array<*> -> json.put(key, JSONObject.wrap(value))
                is List<*> -> json.put(key, value)
                else -> throw IllegalArgumentException("Unsupported type for key: $key, $value")
            }
        }
        return json
    }

    private fun toJson(map: Map<*, *>): JSONObject = JSONObject(map)

    // ── Device / inset helpers ────────────────────────────────────────────────

    private fun getUserAgent(context: Context?): String? =
        try {
            if (context == null) System.getProperty("http.agent")
            else WebSettings.getDefaultUserAgent(context)
        } catch (_: RuntimeException) {
            System.getProperty("http.agent")
        }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun getRootWindowInsetsCompatR(rootView: View): EdgeInsets? {
        val insets = rootView.rootWindowInsets?.getInsets(
            WindowInsets.Type.statusBars() or
                    WindowInsets.Type.displayCutout() or
                    WindowInsets.Type.navigationBars() or
                    WindowInsets.Type.captionBar()
        ) ?: return null
        return EdgeInsets(
            top = insets.top.toFloat(),
            right = insets.right.toFloat(),
            bottom = insets.bottom.toFloat(),
            left = insets.left.toFloat(),
        )
    }

    private fun getRootWindowInsetsCompatBase(rootView: View): EdgeInsets? {
        val rect = Rect()
        rootView.getWindowVisibleDisplayFrame(rect)
        return EdgeInsets(
            top = rect.top.toFloat(),
            right = (rootView.width - rect.right).toFloat(),
            bottom = (rootView.height - rect.bottom).toFloat(),
            left = rect.left.toFloat(),
        )
    }

    private fun getBottomInset(context: Context?): EdgeInsets? {
        val activity = context as? Activity ?: return null
        val rootView = activity.window.decorView
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
            getRootWindowInsetsCompatR(rootView)
        else
            getRootWindowInsetsCompatBase(rootView)
    }

    private fun getCurrentTime(): Double = System.currentTimeMillis().toDouble()
}

data class EdgeInsets(val top: Float, val right: Float, val bottom: Float, val left: Float)
