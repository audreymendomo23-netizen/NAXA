package cm.naxa.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/** Supabase access for the native Compose tracking consent flow. */
class SuiviBluetoothRepository(private val tokenStore: SecureTokenStore) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .callTimeout(20, TimeUnit.SECONDS)
        .build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    suspend fun loadGrantedFamilies(userId: String): Set<String> = withContext(Dispatchers.IO) {
        val token = tokenStore.read()?.first ?: throw IOException("Session NAXA absente.")
        requireConfigured()
        val encodedUser = URLEncoder.encode(userId, Charsets.UTF_8.name())
        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/rest/v1/suivi_consents?select=family_key,granted&user_id=eq.$encodedUser")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .get().build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Lecture du consentement impossible (HTTP ${response.code}).")
            val rows = JSONArray(response.body?.string().orEmpty())
            buildSet {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    if (row.optBoolean("granted")) row.optString("family_key").takeIf { it.isNotBlank() }?.let { add(it) }
                }
            }
        }
    }

    suspend fun setFamilyConsent(userId: String, family: String, granted: Boolean) = withContext(Dispatchers.IO) {
        val token = tokenStore.read()?.first ?: throw IOException("Session NAXA absente.")
        requireConfigured()
        val body = JSONObject().put("p_family", family).put("p_granted", granted)
            .toString().toRequestBody(jsonType)
        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/rest/v1/rpc/suivi_set_family_consent")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json")
            .post(body).build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Enregistrement du consentement impossible (HTTP ${response.code}).")
        }
    }

    private fun requireConfigured() {
        if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            throw IOException("Configuration Supabase Android absente.")
        }
    }
}
