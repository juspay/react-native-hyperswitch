package io.hyperswitch.vault

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import org.json.JSONObject
import java.util.UUID

/*
 * One card form, as native code sees it: a hidden root in the vault's engine that owns the form,
 * and the commands on their way to it. Everything here runs on the main thread.
 *
 * EVERY COMMAND IS ANSWERED EXACTLY ONCE. A command's reply is a promise in the merchant's engine
 * (await tokenize()), so each way a command can end is listed here and each one replies: the
 * bundle's answer, a form that never started, a form that was closed, an engine that stopped, an
 * unreachable bundle, and silence for too long. `pending.remove(commandId)` is the one gate: whoever
 * removes the entry replies, and nobody can remove it twice.
 *
 * Payloads are JSON text made by the bundle's allow-list. This class reads `commandId` and
 * `message` out of them and nothing else, and never logs one.
 */
internal class VaultForm(
  val formId: String,
  private val emit: (name: String, payloadJson: String) -> Unit,
) {
  private sealed interface Phase {
    data object Opening : Phase
    data object Open : Phase
    data class Failed(val message: String) : Phase
  }

  private class Pending(val reply: (String) -> Unit, val timeout: Runnable)

  private val main = Handler(Looper.getMainLooper())
  private var engine: VaultEngine? = null
  private var surface: VaultSurface? = null
  private var phase: Phase = Phase.Opening
  private var closed = false

  /* Commands that arrived before the form's root was up. Run, in order, once it is up or has failed. */
  private val whenSettled = mutableListOf<() -> Unit>()
  private val pending = mutableMapOf<String, Pending>()

  private val events = VaultEventTarget(::onEvent)
  private val openTimeout = Runnable { fail(NOT_STARTED) }

  /* Held here because the engine keeps its listeners weakly. */
  private val onEngineFailure: () -> Unit = { fail(ENGINE_STOPPED) }

  fun open(activity: Activity, settings: String) {
    if (!VaultEngine.isBundled(activity)) return fail(NOT_BUNDLED)
    /* An engine that cannot start ends the form before it mounts, so the merchant's side goes plain. */
    val engine = VaultEngine.get(activity.application) ?: return fail(ENGINE_UNAVAILABLE)
    this.engine = engine
    if (engine.failed) return fail(ENGINE_STOPPED)
    engine.onFailure(onEngineFailure)
    engine.follow(activity)
    /* The hidden root is never put on screen, so it does not need the Activity as its context. */
    surface = engine.start(activity.applicationContext, VaultProtocol.FORM_ROOT, propsOf(settings), events)
    main.postDelayed(openTimeout, OPEN_TIMEOUT_MS)
  }

  /* A prop update for the running root: the form applies it and keeps the card. */
  fun update(settings: String) {
    surface?.update(propsOf(settings))
  }

  fun command(name: String, elementType: String, reply: (String) -> Unit) {
    whenFormSettles {
      val failure = (phase as? Phase.Failed)?.message
      val rootTag = surface?.rootTag
      val engine = engine
      if (failure != null || rootTag == null || engine == null) {
        reply(refusal(failure ?: NOT_OPEN))
        return@whenFormSettles
      }
      val commandId = UUID.randomUUID().toString()
      val timeout = Runnable { pending.remove(commandId)?.reply?.invoke(refusal(NO_ANSWER, delivered = true)) }
      pending[commandId] = Pending(reply, timeout)
      main.postDelayed(timeout, COMMAND_TIMEOUT_MS)

      val sent = engine.send(
        Arguments.createMap().apply {
          putInt("rootTag", rootTag)
          putString("formId", formId)
          putString("commandId", commandId)
          putString("name", name)
          if (elementType.isNotEmpty()) putString("elementType", elementType)
        }
      )
      if (!sent) answer(commandId, refusal(UNREACHABLE))
    }
  }

  fun close() {
    if (closed) return
    closed = true
    main.removeCallbacks(openTimeout)
    surface?.stop()
    surface = null
    settle(Phase.Failed(CLOSED))
    answerAll(refusal(CLOSED, delivered = true))
  }

  /* ---- events from the form's root ---- */

  private fun onEvent(name: String, payloadJson: String) {
    if (closed) return
    when (name) {
      VaultProtocol.COMMAND_RESULT -> {
        /* For the caller of the command, not for the merchant's listeners. */
        val commandId = fieldOf(payloadJson, "commandId") ?: return
        answer(commandId, payloadJson)
        return
      }
      VaultProtocol.FORM_MOUNTED -> {
        main.removeCallbacks(openTimeout)
        settle(Phase.Open)
      }
      VaultProtocol.FORM_ERROR -> {
        main.removeCallbacks(openTimeout)
        settle(Phase.Failed(fieldOf(payloadJson, "message") ?: NOT_STARTED))
      }
    }
    emit(name, payloadJson)
  }

  /* ---- endings ---- */

  /* The form cannot go on, for a reason native code found. The merchant's side is told once. */
  private fun fail(message: String) {
    if (closed || phase is Phase.Failed) return
    main.removeCallbacks(openTimeout)
    phase = Phase.Failed(message)
    drain()
    answerAll(refusal(message, delivered = true))
    emit(VaultProtocol.FORM_ERROR, JSONObject(mapOf("message" to message)).toString())
  }

  private fun whenFormSettles(work: () -> Unit) {
    if (phase is Phase.Opening) whenSettled.add(work) else work()
  }

  private fun settle(next: Phase) {
    if (phase !is Phase.Opening) return
    phase = next
    drain()
  }

  private fun drain() {
    val waiting = whenSettled.toList()
    whenSettled.clear()
    waiting.forEach { it() }
  }

  private fun answer(commandId: String, resultJson: String) {
    val command = pending.remove(commandId) ?: return
    main.removeCallbacks(command.timeout)
    command.reply(resultJson)
  }

  private fun answerAll(resultJson: String) {
    pending.keys.toList().forEach { answer(it, resultJson) }
  }

  private fun propsOf(settings: String) = Bundle().apply {
    putString("formId", formId)
    putInt("protocolVersion", VaultProtocol.VERSION)
    putString("settings", settings)
  }

  companion object {
    /* The bundle has to load and its root has to mount. Long for a slow first start, short for a person waiting. */
    private const val OPEN_TIMEOUT_MS = 15_000L

    /*
     * The only limit on a command: the vault's tokenize request has no timeout of its own, and
     * neither has React Native's HTTP client. A tokenize cut off here was delivered and may still
     * save the card, so its refusal says so (see refusal()).
     */
    private const val COMMAND_TIMEOUT_MS = 90_000L

    const val NOT_BUNDLED = "This build of the app has no card-form bundle."
    private const val ENGINE_UNAVAILABLE = "The card form's engine could not start."
    private const val NOT_STARTED = "The card form did not start."
    private const val NOT_OPEN = "The card form is not open."
    private const val CLOSED = "The card form was closed."
    private const val ENGINE_STOPPED = "The card form's engine stopped."
    private const val UNREACHABLE = "The card form cannot be reached."
    private const val NO_ANSWER = "The card form did not answer."

    /*
     * A command with no answer from the bundle: the same shape the bundle uses for one that did not
     * run. `delivered` marks one that HAD reached the bundle (timeout, form closed, engine stopped):
     * a tokenize may then have saved the card, and the merchant's side reports an unknown outcome,
     * never a failure.
     */
    fun refusal(message: String, delivered: Boolean = false): String =
      JSONObject(
        if (delivered) mapOf("ok" to false, "message" to message, "delivered" to true)
        else mapOf("ok" to false, "message" to message)
      ).toString()

    private fun fieldOf(json: String, key: String): String? =
      try {
        JSONObject(json).optString(key).takeIf { it.isNotEmpty() }
      } catch (_: Exception) {
        null
      }
  }
}

/* The open forms, by formId. Main thread only. */
internal object VaultForms {
  private val forms = mutableMapOf<String, VaultForm>()

  fun open(formId: String, activity: Activity, settings: String, emit: (String, String) -> Unit) {
    /* A formId is opened once. Opening it again replaces the old form, which answers its commands as closed. */
    forms.remove(formId)?.close()
    VaultForm(formId, emit).also { forms[formId] = it }.open(activity, settings)
  }

  fun get(formId: String): VaultForm? = forms[formId]

  fun close(formId: String) {
    forms.remove(formId)?.close()
  }
}
