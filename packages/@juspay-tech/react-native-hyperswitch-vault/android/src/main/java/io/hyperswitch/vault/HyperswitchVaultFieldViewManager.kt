package io.hyperswitch.vault

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event
import com.facebook.react.viewmanagers.HyperswitchVaultFieldViewManagerDelegate
import com.facebook.react.viewmanagers.HyperswitchVaultFieldViewManagerInterface

/*
 * The native view the merchant's engine places for one card field. It is an empty frame in the
 * merchant's layout; inside it sits a root of the vault's own engine, and that root draws the
 * field. The merchant's engine sets three props and hears one event; it never sees what is typed.
 */
class HyperswitchVaultFieldViewManager :
  SimpleViewManager<VaultFieldView>(),
  HyperswitchVaultFieldViewManagerInterface<VaultFieldView> {

  private val delegate: ViewManagerDelegate<VaultFieldView> = HyperswitchVaultFieldViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<VaultFieldView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext) = VaultFieldView(context)

  @ReactProp(name = "formId")
  override fun setFormId(view: VaultFieldView, value: String?) {
    view.formId = value
  }

  @ReactProp(name = "elementType")
  override fun setElementType(view: VaultFieldView, value: String?) {
    view.elementType = value
  }

  @ReactProp(name = "settings")
  override fun setSettings(view: VaultFieldView, value: String?) {
    view.settings = value
  }

  /* Once per batch of prop changes, after every setter above has run. */
  override fun onAfterUpdateTransaction(view: VaultFieldView) {
    super.onAfterUpdateTransaction(view)
    view.render()
  }

  /*
   * The merchant's React Native treats this view as the focused text input while its field has the
   * keyboard, and sends it the commands it would send a text input: "blur" when the user taps
   * outside a field or the app calls Keyboard.dismiss(), "focus" to give it the keyboard. The real
   * input is in the vault's engine, so the command is passed on to the field there.
   */
  override fun receiveCommand(view: VaultFieldView, commandId: String, args: ReadableArray?) {
    when (commandId) {
      "blur", "focus" -> view.command(commandId)
      else -> super.receiveCommand(view, commandId, args)
    }
  }

  override fun onDropViewInstance(view: VaultFieldView) {
    view.stop()
    super.onDropViewInstance(view)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    mutableMapOf(FIELD_EVENT to mutableMapOf("registrationName" to "onFieldEvent"))

  companion object {
    const val NAME = "HyperswitchVaultFieldView"
    const val FIELD_EVENT = "topFieldEvent"
  }
}

@SuppressLint("ViewConstructor")
class VaultFieldView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {
  var formId: String? = null
  var elementType: String? = null
  var settings: String? = null

  private var surface: VaultSurface? = null

  /* Which form and field the running root was started for, and the props it last received. */
  private var startedFor: String? = null
  private var renderedSettings: String? = null

  private val events = VaultEventTarget(::onEvent)

  fun render() {
    val formId = formId?.takeIf { it.isNotEmpty() } ?: return
    val elementType = elementType?.takeIf { it.isNotEmpty() } ?: return
    val settings = settings ?: "{}"
    val identity = "$formId/$elementType"

    val running = surface
    if (running != null && startedFor == identity) {
      /* Same field: new props for the running root, which keeps what was typed. */
      if (settings != renderedSettings) {
        renderedSettings = settings
        running.update(propsOf(formId, elementType, settings))
      }
      return
    }
    /* A different form or field in this view: the old root goes. */
    if (running != null) stop()

    /* Read now, not kept. With no Activity yet, the next prop batch or attach tries again. */
    val activity = reactContext.currentActivity ?: return
    /* The form reports a missing bundle or a stopped engine; its fields just stay empty. */
    if (!VaultEngine.isBundled(activity)) return
    val engine = VaultEngine.get(activity.application)
    if (engine.failed) return
    engine.follow(activity)

    val started = engine.start(reactContext, VaultProtocol.FIELD_ROOT, propsOf(formId, elementType, settings), events)
    surface = started
    startedFor = identity
    renderedSettings = settings
    started.view?.let { addView(it, LayoutParams(MATCH_PARENT, WRAP_CONTENT)) }
  }

  /* A command for this view's field, sent through its form. Nothing waits for the answer. */
  fun command(name: String) {
    val formId = formId?.takeIf { it.isNotEmpty() } ?: return
    val elementType = elementType?.takeIf { it.isNotEmpty() } ?: return
    VaultForms.get(formId)?.command(name, elementType) {}
  }

  fun stop() {
    surface?.stop()
    surface = null
    startedFor = null
    renderedSettings = null
    removeAllViews()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (surface == null) render()
  }

  /*
   * The merchant's React Native lays this view out, and knows nothing of the child added above, so
   * it never measures it. The child is measured here instead: as wide as this view, as tall as its
   * own content. The merchant's side then makes this view that tall (VAULT_FIELD_LAYOUT).
   */
  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
    super.onSizeChanged(width, height, oldWidth, oldHeight)
    if (width != oldWidth) post(measureAndLayout)
  }

  private val measureAndLayout = Runnable {
    val child = getChildAt(0) ?: return@Runnable
    if (width == 0) return@Runnable
    child.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED),
    )
    child.layout(0, 0, width, child.measuredHeight)
  }

  /* From the field's root, on the main thread: on to the merchant's engine as this view's event. */
  private fun onEvent(name: String, payloadJson: String) {
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
      ?.dispatchEvent(FieldEvent(UIManagerHelper.getSurfaceId(this), id, name, payloadJson))
  }

  private fun propsOf(formId: String, elementType: String, settings: String) = Bundle().apply {
    putString("formId", formId)
    putString("elementType", elementType)
    putInt("protocolVersion", VaultProtocol.VERSION)
    putString("settings", settings)
  }

  private class FieldEvent(surfaceId: Int, viewId: Int, private val name: String, private val payloadJson: String) :
    Event<FieldEvent>(surfaceId, viewId) {
    override fun getEventName() = HyperswitchVaultFieldViewManager.FIELD_EVENT

    /*
     * Every field event must arrive. React Native merges events of one name on one view and keeps
     * only the newest, which is right for a scroll position and wrong here: all of a field's events
     * share this one name, so its height would be thrown away whenever "ready" came right after it.
     */
    override fun canCoalesce() = false

    override fun getEventData(): WritableMap = Arguments.createMap().apply {
      putString("name", name)
      putString("payload", payloadJson)
    }
  }
}
