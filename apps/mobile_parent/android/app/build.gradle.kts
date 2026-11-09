import java.util.Properties

plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    // END: FlutterFire Configuration
    // The Flutter Gradle Plugin must be applied after the Android Gradle plugin.
    id("dev.flutter.flutter-gradle-plugin")
}

val uploadPropertiesFile = rootProject.file("key.properties")
val uploadProperties = Properties().apply {
    if (uploadPropertiesFile.isFile) {
        uploadPropertiesFile.inputStream().use { load(it) }
    }
}
val uploadStorePath = uploadProperties.getProperty("storeFile")?.takeIf { it.isNotBlank() }
val uploadStoreFile = uploadStorePath?.let { rootProject.file(it) }

// Validate only when app release tasks are requested, so debug builds remain usable.
gradle.taskGraph.whenReady {
    if (allTasks.any { it.project == project && it.name.contains("release", ignoreCase = true) }) {
        val required = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
        val missing = required.filter { uploadProperties.getProperty(it).isNullOrBlank() }
        if (!uploadPropertiesFile.isFile || missing.isNotEmpty()) {
            throw GradleException(
                "Release signing requires android/key.properties with non-empty " +
                    "storeFile, storePassword, keyAlias and keyPassword."
            )
        }
        if (uploadStoreFile == null || !uploadStoreFile.isFile || !uploadStoreFile.canRead()) {
            throw GradleException("Release signing requires a readable upload keystore at the configured storeFile.")
        }
    }
}

android {
    namespace = "com.takween.edu.mobile_parent"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.takween.edu.mobile_parent"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("upload") {
            storeFile = uploadStoreFile
            storePassword = uploadProperties.getProperty("storePassword")
            keyAlias = uploadProperties.getProperty("keyAlias")
            keyPassword = uploadProperties.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("upload")
        }
    }
}

flutter {
    source = "../.."
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}
