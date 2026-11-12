plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
val firebaseApiKey = providers.gradleProperty("FIREBASE_API_KEY").orElse(providers.environmentVariable("FIREBASE_API_KEY")).getOrElse("")
val firebaseAppId = providers.gradleProperty("FIREBASE_APP_ID").orElse(providers.environmentVariable("FIREBASE_APP_ID")).getOrElse("")
val firebaseProjectId = providers.gradleProperty("FIREBASE_PROJECT_ID").orElse(providers.environmentVariable("FIREBASE_PROJECT_ID")).getOrElse("")
val firebaseSenderId = providers.gradleProperty("FIREBASE_SENDER_ID").orElse(providers.environmentVariable("FIREBASE_SENDER_ID")).getOrElse("")
fun buildConfigString(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

android {
    namespace = "cm.naxa.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "cm.naxa.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "NAXA_BASE_URL", "\"https://nnaxa.vercel.app\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
}
