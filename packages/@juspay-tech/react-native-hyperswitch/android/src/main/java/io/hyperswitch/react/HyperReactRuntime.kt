package io.hyperswitch.react

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler
import com.hyperswitchsdkreactnative.BuildConfig

/**
 * The host-lifecycle part of client-core's HyperReactRuntime. Here the host stays owned (and
 * possibly recreated) by [ReactNativeController], and the old architecture runs on its
 * ReactInstanceManager, so the calls go to whichever of the two is current.
 */
object HyperReactRuntime : DefaultLifecycleObserver {

    /**
     * Makes the host follow [activity]'s lifecycle, the way a React Native app's own Activity
     * does. On Android, React Native runs JS timers only while the host is resumed, and every
     * `fetch` resolves through a timer, so a session's JS does no work until the Activity it
     * was created for has resumed the host and none while that Activity is paused. Destroying
     * the Activity drops the host's reference to it.
     *
     * Idempotent for a lifecycle owner (every AndroidX Activity): its lifecycle keeps one
     * registration per observer, and this runtime is the only observer the SDK adds. A plain
     * Activity has no lifecycle to observe, so it is taken as resumed now and the Application
     * reports its transitions from then on.
     */
    fun follow(activity: Activity) {
        onMain {
            if (activity is LifecycleOwner) {
                activity.lifecycle.addObserver(this)
            } else {
                resume(activity)
                activity.application.registerActivityLifecycleCallbacks(PlainActivityWatcher(activity))
            }
        }
    }

    override fun onResume(owner: LifecycleOwner) = resume(owner as Activity)

    override fun onPause(owner: LifecycleOwner) = pause()

    override fun onDestroy(owner: LifecycleOwner) {
        destroy(owner as Activity)
        owner.lifecycle.removeObserver(this)
    }

    private fun resume(activity: Activity) {
        val backHandler = activity as? DefaultHardwareBackBtnHandler
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            ReactNativeController.getReactHost().onHostResume(activity, backHandler)
        } else {
            val manager = ReactNativeController.getReactNativeHost().reactInstanceManager
            if (backHandler != null) manager.onHostResume(activity, backHandler) else manager.onHostResume(activity)
        }
    }

    private fun pause() {
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            ReactNativeController.getReactHost().onHostPause()
        } else {
            ReactNativeController.getReactNativeHost().reactInstanceManager.onHostPause()
        }
    }

    private fun destroy(activity: Activity) {
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            ReactNativeController.getReactHost().onHostDestroy(activity)
        } else {
            ReactNativeController.getReactNativeHost().reactInstanceManager.onHostDestroy(activity)
        }
    }

    private class PlainActivityWatcher(private val activity: Activity) :
        Application.ActivityLifecycleCallbacks {
        override fun onActivityResumed(activity: Activity) {
            if (activity === this.activity) HyperReactRuntime.resume(activity)
        }

        override fun onActivityPaused(activity: Activity) {
            if (activity === this.activity) HyperReactRuntime.pause()
        }

        override fun onActivityDestroyed(activity: Activity) {
            if (activity !== this.activity) return
            HyperReactRuntime.destroy(activity)
            activity.application.unregisterActivityLifecycleCallbacks(this)
        }

        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
        override fun onActivityStarted(activity: Activity) {}
        override fun onActivityStopped(activity: Activity) {}
        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    }

    private fun onMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else Handler(Looper.getMainLooper()).post(block)
    }
}
