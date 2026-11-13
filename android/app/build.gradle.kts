plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}
fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
val naxaBaseUrl = providers.gradleProperty("NAXA_BASE_URL").orElse(providers.environmentVariable("NAXA_BASE_URL")).getOrElse("https://naxa-opal.vercel.app")
val supabaseUrl = providers.gradleProperty("SUPABASE_URL").orElse(providers.environmentVariable("SUPABASE_URL")).getOrElse("")
val supabaseAnonKey = providers.gradleProperty("SUPABASE_ANON_KEY").orElse(providers.environmentVariable("SUPABASE_ANON_KEY")).getOrElse("")
val firebaseApiKey = providers.gradleProperty("FIREBASE_API_KEY").orElse(providers.environmentVariable("FIREBASE_API_KEY")).getOrElse("")
val firebaseAppId = providers.gradleProperty("FIREBASE_APP_ID").orElse(providers.environmentVariable("FIREBASE_APP_ID")).getOrElse("")
val firebaseProjectId = providers.gradleProperty("FIREBASE_PROJECT_ID").orElse(providers.environmentVariable("FIREBASE_PROJECT_ID")).getOrElse("")
val firebaseSenderId = providers.gradleProperty("FIREBASE_SENDER_ID").orElse(providers.environmentVariable("FIREBASE_SENDER_ID")).getOrElse("")
android {
    namespace = "cm.naxa.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "cm.naxa.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "NAXA_BASE_URL", quoted(naxaBaseUrl))
        buildConfigField("String", "SUPABASE_URL", quoted(supabaseUrl))
        buildConfigField("String", "SUPABASE_ANON_KEY", quoted(supabaseAnonKey))
        buildConfigField("String", "FIREBASE_API_KEY", quoted(firebaseApiKey))
        buildConfigField("String", "FIREBASE_APP_ID", quoted(firebaseAppId))
        buildConfigField("String", "FIREBASE_PROJECT_ID", quoted(firebaseProjectId))
        buildConfigField("String", "FIREBASE_SENDER_ID", quoted(firebaseSenderId))
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("com.google.mlkit:text-recognition:16.0.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
