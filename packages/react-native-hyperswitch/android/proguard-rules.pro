# Hyperswitch SDK ProGuard Rules

# Keep public classes and methods that are part of the SDK API
-keep public class com.hyperswitchsdkreactnative.** {
    public *;
}

# Keep React Native module classes
-keep class com.hyperswitchsdkreactnative.modules.** { *; }
-keep class com.hyperswitchsdkreactnative.provider.** { *; }
-keep class com.hyperswitchsdkreactnative.gpay.** { *; }
-keep class com.hyperswitchsdkreactnative.utils.** { *; }

# Keep annotation classes
-keepattributes *Annotation*
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeInvisibleAnnotations

# Keep Kotlin metadata
-keep class kotlin.Metadata { *; }
-keep class kotlin.jvm.internal.Intrinsics { *; }

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# Keep Google Pay classes
-keep class com.google.android.gms.wallet.** { *; }
-keep class com.google.android.gms.common.api.** { *; }

# Keep AndroidX classes that are commonly used
-keep class androidx.lifecycle.** { *; }
-keep class androidx.fragment.** { *; }
-keep class androidx.activity.** { *; }

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep serializable classes
-keepnames class * implements java.io.Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    !private <methods>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep callback methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep promise-related classes
-keep class com.facebook.react.bridge.Promise { *; }
-keep class com.facebook.react.bridge.WritableMap { *; }
-keep class com.facebook.react.bridge.ReadableMap { *; }

# Optimization settings
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontpreverify
-verbose
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*