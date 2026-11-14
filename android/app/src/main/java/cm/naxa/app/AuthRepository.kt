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

data class NaxaProfile(
    val userId: String,
    val role: String,
    val ageVerified: Boolean,
    val activeRole: String = role,
    val activePharmacyId: String? = null,
    val activePartnerId: String? = null,
    val activePartnerType: String? = null
) {
    val effectiveRole: String
        get() = activeRole.ifBlank { role }
}
data class AuthResult(val profile: NaxaProfile, val accessToken: String, val refreshToken: String)

private class NaxaHttpException(
    val statusCode: Int,
    val errorCode: String,
    message: String
) : IOException(message)

class AuthRepository(private val tokenStore: SecureTokenStore) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS)
        .build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    suspend fun signIn(email: String, password: String): AuthResult = withContext(Dispatchers.IO) {
        requireConfigured()
        val body = JSONObject().put("email", email.trim()).put("password", password)
        val response = execute(
            Request.Builder()
                .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1/token?grant_type=password")
                .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                .header("Content-Type", "application/json")
                .post(body.toString().toRequestBody(jsonType))
                .build()
        )
        val access = response.optString("access_token")
        val refresh = response.optString("refresh_token")
        if (access.isBlank() || refresh.isBlank()) throw IOException("Réponse Auth incomplète.")
        val profile = loadProfile(access)
        tokenStore.save(access, refresh)
        AuthResult(profile, access, refresh)
    }

    /**
     * Keeps the encrypted session on transient network/API errors.
     * A refresh is attempted only when the API explicitly rejects the access token.
     */
    suspend fun restoreSession(): NaxaProfile? = withContext(Dispatchers.IO) {
        if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            return@withContext null
        }
        val saved = tokenStore.read() ?: return@withContext null

        try {
            return@withContext loadProfile(saved.first)
        } catch (error: NaxaHttpException) {
            if (error.statusCode != 401 || error.errorCode != "AUTH_INVALID") throw error
        }

        val refreshed = try {
            execute(
                Request.Builder()
                    .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1/token?grant_type=refresh_token")
                    .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    .header("Content-Type", "application/json")
                    .post(JSONObject().put("refresh_token", saved.second).toString().toRequestBody(jsonType))
                    .build()
            )
        } catch (error: NaxaHttpException) {
            if (error.statusCode in 400..401) {
                tokenStore.clear()
                return@withContext null
            }
            throw error
        }

        val access = refreshed.optString("access_token")
        val refresh = refreshed.optString("refresh_token")
        if (access.isBlank() || refresh.isBlank()) throw IOException("Renouvellement de session incomplet.")
        val profile = try {
            loadProfile(access)
        } catch (error: NaxaHttpException) {
            if (error.statusCode == 401) tokenStore.clear()
            throw error
        }
        tokenStore.save(access, refresh)
        profile
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        val saved = tokenStore.read()
        if (saved != null && BuildConfig.SUPABASE_URL.isNotBlank() && BuildConfig.SUPABASE_ANON_KEY.isNotBlank()) {
            try {
                execute(
                    Request.Builder()
                        .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1/logout")
                        .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                        .header("Authorization", "Bearer ${saved.first}")
                        .post("".toRequestBody(null))
                        .build()
                )
            } catch (_: Exception) {
                // Local credentials are always removed; remote expiry/revocation remains server-controlled.
            }
        }
        tokenStore.clear()
    }

    private fun loadProfile(accessToken: String): NaxaProfile {
        val response = execute(
            Request.Builder()
                .url("${BuildConfig.NAXA_BASE_URL.trimEnd('/')}/api/v1/auth/session")
                .header("Authorization", "Bearer $accessToken")
                .get()
                .build()
        )
        val profile = response.optJSONObject("profile") ?: throw IOException("Profil NAXA absent.")
        if (!profile.optBoolean("active", false)) throw IOException("Compte inactif ou suspendu.")
        val userId = response.optJSONObject("user")?.optString("id").orEmpty()
        if (userId.isBlank()) throw IOException("Identité de session absente.")
        val ageVerified = profile.optBoolean("ageVerified", false)
        if (!ageVerified) {
            throw NaxaHttpException(
                403,
                "AGE_VERIFICATION_REQUIRED",
                "La vérification de majorité de ce compte doit être terminée avant l'accès."
            )
        }
        val baseRole = profile.optString("role", "Compte NAXA")
        return NaxaProfile(
            userId = userId,
            role = baseRole,
            ageVerified = true,
            activeRole = profile.optString("activeRole").takeIf { it.isNotBlank() } ?: baseRole,
            activePharmacyId = profile.optString("activePharmacyId").takeIf { it.isNotBlank() },
            activePartnerId = profile.optString("activePartnerId").takeIf { it.isNotBlank() },
            activePartnerType = profile.optString("activePartnerType").takeIf { it.isNotBlank() }
        )
    }

    private fun execute(request: Request): JSONObject {
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val payload = try {
                if (raw.isBlank()) JSONObject() else JSONObject(raw)
            } catch (_: Exception) {
                JSONObject()
            }
            if (!response.isSuccessful || (payload.has("ok") && !payload.optBoolean("ok"))) {
                val code = payload.optString("code").ifBlank { payload.optString("error") }
                val message = when (code) {
                    "AUTH_REQUIRED", "AUTH_INVALID", "invalid_grant" -> "Identifiants invalides ou session expirée."
                    "PROFILE_INACTIVE" -> "Compte inactif ou suspendu."
                    "AGE_VERIFICATION_REQUIRED" -> "La vérification de majorité de ce compte doit être terminée."
                    "PROFILE_LOOKUP_UNAVAILABLE", "PROFILE_CONTEXT_UNAVAILABLE", "AUTH_UNAVAILABLE" ->
                        "Contexte de compte indisponible. Réessayez dans quelques instants."
                    else -> payload.optString("msg")
                        .ifBlank { payload.optString("message") }
                        .ifBlank { "Connexion impossible (HTTP ${response.code})." }
                }
                throw NaxaHttpException(response.code, code, message)
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
