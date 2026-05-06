# ============================================================
# Zilcycler ProGuard Rules
# Tells R8/ProGuard which code MUST NOT be obfuscated
# (Capacitor plugins, JavaScript bridge, etc.)
# ============================================================

# Capacitor core - keep all
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
}

# Capacitor plugins - keep all plugin classes
-keep class com.capacitorjs.** { *; }
-keep class * extends com.getcapacitor.Plugin

# WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep all annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
-keepattributes Exceptions

# Keep generic types for reflection
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# AndroidX
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# Kotlin
-keep class kotlin.** { *; }
-keep class kotlinx.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# OkHttp & Okio (used by some Capacitor plugins)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# Suppress warnings about reflective access
-dontwarn java.lang.invoke.**
-dontwarn java.lang.management.**

# Preserve crash report line numbers (helps debug crashes from Play Console)
-renamesourcefileattribute SourceFile

# Native methods (JNI)
-keepclasseswithmembernames class * {
    native <methods>;
}

# Enums (Android serialization)
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Parcelables (Android IPC)
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# Serializables
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# WebView caching - keep WebView callback classes
-keep class * extends android.webkit.WebViewClient
-keep class * extends android.webkit.WebChromeClient

# Don't strip JavaScript bridge classes
-keep class com.getcapacitor.MessageHandler { *; }
-keep class com.getcapacitor.JSObject { *; }
-keep class com.getcapacitor.PluginCall { *; }

# Cordova plugins (some Capacitor plugins inherit from Cordova)
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**