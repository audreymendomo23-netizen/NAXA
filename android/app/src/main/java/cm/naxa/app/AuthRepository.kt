package cm.naxa.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class NaxaProfile(val userId: String, val role: String, val ageVerified: Boolean)
data class AuthResult(val profile: NaxaProfile, val accessToken: String, val refreshToken: String)

class AuthRepository(private val tokenStore: SecureTokenStore) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS).build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    suspend fun signIn(email: String, password: String): AuthResult = withContext(Dispatchers.IO) {
        requireConfigured()
        val body = JSONObject().put("email", email.trim()).put("password", password)
        val response = execute(Request.Builder()
            .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1/token?grant_type=password")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .post(body.toString().toRequestBody(jsonType)).build())
        val access = response.optString("access_token")
        val refresh = response.optString("refresh_token")
        if (access.isBlank() || refresh.isBlank()) throw IOException("Réponse Auth incomplète.")
        val profile = loadProfile(access)
        tokenStore.save(access, refresh)
        AuthResult(profile, access, refresh)
    }

    suspend fun restoreSession(): NaxaProfile? = withContext(Dispatchers.IO) {
        requireConfigured()
        val saved = tokenStore.read() ?: return@withContext null
        try {
            loadProfile(saved.first)
        } catch (_: Exception) {
            try {
                val refreshed = execute(Request.Builder()
                    .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1/token?grant_type=refresh_token")
                    .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    .header("Content-Type", "application/json")
                    .post(JSONObject().put("refresh_token", saved.second).toString().toRequestBody(jsonType)).build())
                val access = refreshed.optString("access_token")
                val refresh = refreshed.optString("refresh_token")
                if (access.isBlank() || refresh.isBlank()) throw IOException("Renouvellement de session incomplet.")
                val profile = loadProfile(access)
                tokenStore.save(access, refresh)
                profile
            } catch (_: Exception) {
                tokenStore.clear()
                null
            }
        }
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        val saved = tokenStore.read()
        if (saved != null && BuildConfig.SUPABASE_URL.isNotBlank()) {
            try {
                execute(Request.Builder()
                    .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1/logout")
                    .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    .header("Authorization", "Bearer ${saved.first}")
                    .post("".toRequestBody(null)).build())
            } catch (_: Exception) { /* Local credentials are always cleared. */ }
        }
        tokenStore.clear()
    }

    private fun loadProfile(accessToken: String): NaxaProfile {
        val response = execute(Request.Builder()
            .url("${BuildConfig.NAXA_BASE_URL.trimEnd('/')}/api/v1/auth/session")
            .header("Authorization", "Bearer $accessToken").get().build())
        val profile = response.optJSONObject("profile") ?: throw IOException("Profil NAXA absent.")
        if (!profile.optBoolean("active", false)) throw IOException("Compte inactif ou suspendu.")
        return NaxaProfile(
            userId = response.optJSONObject("user")?.optString("id").orEmpty(),
            role = profile.optString("role", "Compte NAXA"),
            ageVerified = profile.optBoolean("ageVerified", false)
        )
    }

    private fun execute(request: Request): JSONObject {
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val payload = try { if (raw.isBlank()) JSONObject() else JSONObject(raw) } catch (_: Exception) { JSONObject() }
            if (!response.isSuccessful || payload.optBoolean("ok") == false) {
                val message = when (payload.optString("code")) {
                    "AUTH_REQUIRED", "AUTH_INVALID" -> "Identifiants invalides ou session expirée."
                    "PROFILE_INACTIVE" -> "Compte inactif ou suspendu."
                    "PROFILE_LOOKUP_UNAVAILABLE", "AUTH_UNAVAILABLE" -> "Service temporairement indisponible. Réessayez."
                    else -> payload.optString("msg").ifBlank { "Connexion impossible (HTTP ${response.code})." }
                }
                throw IOException(message)
            }
            return payload
        }
    }

    private fun requireConfigured() {
        if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            throw IOException("Configuration Android manquante : SUPABASE_URL et SUPABASE_ANON_KEY.")
        }
    }
}
