package io.hyperswitch.vault

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import com.facebook.react.ReactHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.JSBundleLoader
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.defaults.DefaultComponentsRegistry
import com.facebook.react.defaults.DefaultReactHostDelegate
import com.facebook.react.defaults.DefaultTurboModuleManagerDelegate
import com.facebook.react.fabric.ComponentFactory
import com.facebook.react.interfaces.fabric.ReactSurface
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler
import com.facebook.react.runtime.ReactHostImpl
import com.facebook.react.runtime.ReactSurfaceImpl
import com.facebook.react.runtime.hermes.HermesInstance
import com.facebook.react.shell.MainReactPackage
import java.lang.ref.WeakReference
import java.util.Collections
import java.util.WeakHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference

/*
 * The vault's own JavaScript engine: a second React host with its own Hermes instance, started the
 * first time a card form opens and kept for the life of the app process. It runs only
 * hyperswitch-vault-fields.bundle. The card number and the CVC exist in THIS engine's memory and in
 * the text inputs it draws; the merchant's engine never holds them.
 *
 * WHAT THIS ENGINE CAN REACH. A fixed, short list of packages: React Native's own, react-native-svg
 * (the fields draw their icons with it), scan card when the app has it (the number field's scan
 * button), and the one module the bundle talks to. Not the app's
 * autolinked packages: the card engine has no use for them, and the vault's own merchant-side
 * module must not be in here, or the bundle could try to start an engine from inside an engine.
 *
 * NO CODE FROM OUTSIDE. The bundle is read from the app's assets. Packager access and developer
 * support are off in every build type, so this engine never loads JavaScript from a Metro server.
 */
internal class VaultEngine private constructor(private val application: Application) :
  Application.ActivityLifecycleCallbacks {

  private val hostedModule = AtomicReference<WeakReference<HyperswitchVaultHostedModule>?>(null)

  /*
   * The running roots and who owns each. An event from the bundle names its root by root tag, and
   * the owner is found by asking each root for its tag WHEN THE EVENT ARRIVES. The tag cannot be
   * the key of a map filled in at creation: React Native gives a root its tag only once it has
   * started, which is after start() returns.
   */
  private val running = CopyOnWriteArrayList<VaultSurface>()

  private val followed: MutableSet<Activity> = Collections.newSetFromMap(WeakHashMap())
  private val main = Handler(Looper.getMainLooper())

  /* Set once, if the engine throws. Every open form is told, and new forms fail at once. */
  @Volatile
  var failed = false
    private set
  private val failureListeners = Collections.newSetFromMap(WeakHashMap<() -> Unit, Boolean>())

  val reactHost: ReactHost = createReactHost()

  init {
    application.registerActivityLifecycleCallbacks(this)
  }

  /* ---- roots ---- */

  /* Starts a root of the bundle. `owner` receives its events until stop(). Main thread. */
  fun start(context: Context, rootName: String, props: Bundle, owner: VaultEventTarget): VaultSurface {
    val surface = VaultSurface(this, reactHost.createSurface(context, rootName, props), owner)
    running.add(surface)
    surface.start()
    return surface
  }

  internal fun forget(surface: VaultSurface) {
    running.remove(surface)
  }

  /* From the bundle, on its JavaScript thread: hand the event to the root's owner on the main thread. */
  fun deliver(rootTag: Int, eventName: String, payloadJson: String) {
    main.post { running.firstOrNull { it.rootTag == rootTag }?.owner?.onVaultEvent(eventName, payloadJson) }
  }

  /* ---- commands ---- */

  fun attach(module: HyperswitchVaultHostedModule) = hostedModule.set(WeakReference(module))

  fun detach(module: HyperswitchVaultHostedModule) {
    if (hostedModule.get()?.get() === module) hostedModule.set(null)
  }

  /* False when the bundle cannot be reached: the caller answers the command itself. */
  fun send(command: WritableMap): Boolean {
    val module = hostedModule.get()?.get() ?: return false
    return try {
      module.sendCommand(command)
      true
    } catch (_: Exception) {
      false
    }
  }

  /* ---- failure ---- */

  fun onFailure(listener: () -> Unit) {
    synchronized(failureListeners) { failureListeners.add(listener) }
  }

  private fun fail(error: Exception) {
    /* The class only. An exception's message can carry what the customer typed. */
    Log.e(TAG, "The card form's engine stopped: ${error.javaClass.simpleName}")
    failed = true
    val listeners = synchronized(failureListeners) { failureListeners.toList() }
    main.post { listeners.forEach { it() } }
  }

  /* ---- the Activity the engine draws in ---- */

  /*
   * The engine needs to know which Activity is in front: without it React Native neither draws nor
   * shows a keyboard. The Activity is read when a form or a field asks, never kept beyond its life.
   */
  fun follow(activity: Activity) {
    if (!followed.add(activity)) return
    resume(activity)
  }

  private fun resume(activity: Activity) =
    reactHost.onHostResume(activity, activity as? DefaultHardwareBackBtnHandler)

  override fun onActivityResumed(activity: Activity) {
    if (activity in followed) resume(activity)
  }

  override fun onActivityPaused(activity: Activity) {
    if (activity in followed) reactHost.onHostPause(activity)
  }

  override fun onActivityDestroyed(activity: Activity) {
    if (followed.remove(activity)) reactHost.onHostDestroy(activity)
  }

  override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
  override fun onActivityStarted(activity: Activity) = Unit
  override fun onActivityStopped(activity: Activity) = Unit
  override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit

  /* ---- the host ---- */

  @OptIn(UnstableReactNativeAPI::class)
  private fun createReactHost(): ReactHost {
    val packages = mutableListOf<ReactPackage>(MainReactPackage(), HyperswitchVaultHostedPackage(this))
    optionalPackage(SVG_PACKAGE)?.let(packages::add)
    /* When the app has scan card, the number field's scan button works here as in the plain fields. */
    optionalPackage(SCANCARD_PACKAGE)?.let(packages::add)

    val delegate = DefaultReactHostDelegate(
      jsMainModulePath = VaultProtocol.ENTRY_FILE,
      jsBundleLoader = JSBundleLoader.createAssetLoader(application, "assets://${VaultProtocol.BUNDLE_NAME}", true),
      reactPackages = packages,
      jsRuntimeFactory = HermesInstance(),
      bindingsInstaller = null,
      turboModuleManagerDelegateBuilder = DefaultTurboModuleManagerDelegate.Builder(),
      exceptionHandler = ::fail,
    )
    val componentFactory = ComponentFactory()
    DefaultComponentsRegistry.register(componentFactory)

    return ReactHostImpl(
      application,
      delegate,
      componentFactory,
      false, /* allowPackagerServerAccess */
      false, /* useDevSupport */
    )
  }

  /* A package of the app that this engine uses when the app has it, found by name. */
  private fun optionalPackage(className: String): ReactPackage? =
    try {
      Class.forName(className).getDeclaredConstructor().newInstance() as? ReactPackage
    } catch (_: Throwable) {
      null
    }

  companion object {
    private const val TAG = "HyperswitchVault"
    private const val SVG_PACKAGE = "com.horcrux.svg.SvgPackage"
    private const val SCANCARD_PACKAGE = "com.reactnativehyperswitchscancard.HyperswitchScancardPackage"

    @Volatile
    private var instance: VaultEngine? = null

    /* Set once, if the engine could not be created. Never retried in this process. */
    @Volatile
    private var unavailable = false

    @Volatile
    private var bundled: Boolean? = null

    /* Whether this build of the app carries the bundle. Checked once. */
    fun isBundled(context: Context): Boolean =
      bundled ?: (context.assets.list("")?.contains(VaultProtocol.BUNDLE_NAME) == true).also { bundled = it }

    /*
     * The engine, or null when it cannot start in this app. The first call builds the React host
     * and its Hermes runtime. If that throws (a library the app's build left out, for example), the
     * failure is logged by class name, remembered, and never retried: every form then falls back to
     * the plain fields instead of crashing the app.
     */
    fun get(application: Application): VaultEngine? {
      instance?.let { return it }
      return synchronized(this) {
        instance ?: if (unavailable) null else try {
          VaultEngine(application).also { instance = it }
        } catch (t: Throwable) {
          Log.e(TAG, "The card form's engine could not start: ${t.javaClass.simpleName}")
          unavailable = true
          null
        }
      }
    }
  }
}

/* One running root of the bundle, and who receives its events. */
internal class VaultSurface(
  private val engine: VaultEngine,
  private val surface: ReactSurface,
  val owner: VaultEventTarget,
) {
  /* What the bundle calls rootTag. Meaningful only once the root has started. */
  val rootTag: Int
    get() = surface.surfaceID

  val view: View?
    get() = surface.view

  internal fun start() {
    surface.start()
  }

  /* New props for the running root. The root keeps its state: this is an update, not a restart. */
  fun update(props: Bundle) {
    (surface as? ReactSurfaceImpl)?.updateInitProps(props)
  }

  fun stop() {
    engine.forget(this)
    surface.stop()
    surface.detach()
  }
}
