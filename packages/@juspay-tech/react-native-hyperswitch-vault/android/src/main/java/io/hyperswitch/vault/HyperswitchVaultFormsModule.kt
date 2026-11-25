package io.hyperswitch.vault

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.systeminfo.ReactNativeVersion
import org.json.JSONObject

/*
 * The module the MERCHANT's engine talks to (src/native in the vault's JavaScript). It opens,
 * updates and closes card forms in the vault's own engine and carries commands to them.
 *
 * What crosses here, in both directions, is JSON text. Going in: the merchant's own settings.
 * Coming out: events and results the hosted bundle has already cut down to its allow-list. This
 * class passes the text on and never logs it.
 */
class HyperswitchVaultFormsModule(context: ReactApplicationContext) :
  NativeHyperswitchVaultFormsSpec(context) {

  private val main = Handler(Looper.getMainLooper())

  /* The forms this engine opened, so they end with it (a reload of the merchant's JavaScript). */
  private val opened = mutableSetOf<String>()

  override fun getTypedExportedConstants(): Map<String, Any> = mapOf(
    "newArchitecture" to BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
    "reactNativeMinor" to ((ReactNativeVersion.VERSION["minor"] as? Int) ?: 0),
    "protocolVersion" to VaultProtocol.VERSION,
    "bundled" to VaultEngine.isBundled(reactApplicationContext),
  )

  override fun openForm(formId: String, settings: String) = onMain {
    /* Read now, not kept: the Activity can be gone by the next call. */
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      send(formId, VaultProtocol.FORM_ERROR, JSONObject(mapOf("message" to NO_ACTIVITY)).toString())
      return@onMain
    }
    opened.add(formId)
    VaultForms.open(formId, activity, settings) { name, payload -> send(formId, name, payload) }
  }

  override fun updateForm(formId: String, settings: String) = onMain {
    VaultForms.get(formId)?.update(settings)
  }

  override fun closeForm(formId: String) = onMain {
    opened.remove(formId)
    VaultForms.close(formId)
  }

  /* Always resolves. A command that could not run resolves with {"ok":false,"message":...}. */
  override fun sendCommand(formId: String, name: String, elementType: String, promise: Promise) = onMain {
    val form = VaultForms.get(formId)
    if (form == null) {
      promise.resolve(VaultForm.refusal(NOT_OPEN))
    } else {
      form.command(name, elementType) { result -> promise.resolve(result) }
    }
  }

  override fun invalidate() {
    val leaving = opened.toList()
    opened.clear()
    onMain { leaving.forEach(VaultForms::close) }
    super.invalidate()
  }

  private fun send(formId: String, name: String, payloadJson: String) {
    if (!reactApplicationContext.hasActiveReactInstance()) return
    emitOnFormEvent(
      Arguments.createMap().apply {
        putString("formId", formId)
        putString("name", name)
        putString("payload", payloadJson)
      }
    )
  }

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
  }

  companion object {
    private const val NO_ACTIVITY = "There is no screen to show the card form in."
    private const val NOT_OPEN = "The card form is not open."
  }
}
