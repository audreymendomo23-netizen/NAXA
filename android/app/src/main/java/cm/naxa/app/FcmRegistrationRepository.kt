package cm.naxa.app

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class FcmRegistrationRepository(context: Context, private val tokenStore: SecureTokenStore) {
    private val appContext = context.applicationContext
    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .callTimeout(20, TimeUnit.SECONDS)
        .build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    suspend fun register(fcmToken: String) = withContext(Dispatchers.IO) {
        val session = tokenStore.read() ?: throw IOException("Connectez-vous avant d'activer les notifications.")
        requireValidToken(fcmToken)
        send(
            Request.Builder()
                .url(BuildConfig.NAXA_BASE_URL.trimEnd('/') + "/api/notifications/fcm/register")
                .header("Authorization", "Bearer ${session.first}")
                .header("Content-Type", "application/json")
                .post(JSONObject().put("token", fcmToken).toString().toRequestBody(jsonType))
                .build()
        )
    }

    suspend fun unregisterCurrentDevice() = withContext(Dispatchers.IO) {
        val prefs = appContext.getSharedPreferences(NaxaFirebaseMessagingService.PREFS, Context.MODE_PRIVATE)
        val token = prefs.getString(NaxaFirebaseMessagingService.TOKEN_KEY, null)
        if (!token.isNullOrBlank()) {
            unregister(token)
            prefs.edit().remove(NaxaFirebaseMessagingService.TOKEN_KEY).apply()
        }
    }

    suspend fun unregister(fcmToken: String) = withContext(Dispatchers.IO) {
        val session = tokenStore.read() ?: return@withContext
        requireValidToken(fcmToken)
        send(
            Request.Builder()
                .url(BuildConfig.NAXA_BASE_URL.trimEnd('/') + "/api/notifications/fcm/register")
                .header("Authorization", "Bearer ${session.first}")
                .header("Content-Type", "application/json")
                .delete(JSONObject().put("token", fcmToken).toString().toRequestBody(jsonType))
                .build()
        )
    }

    private fun send(request: Request) {
        http.newCall(request).execute().use { response ->
            val payload = try {
                JSONObject(response.body?.string().orEmpty())
            } catch (_: Exception) {
                JSONObject()
            }
            if (!response.isSuccessful || (payload.has("ok") && !payload.optBoolean("ok"))) {
                val message = payload.optString("error").ifBlank {
                    "Enregistrement des notifications impossible (HTTP ${response.code})."
                }
                throw IOException(message)
            }
        }
    }

    private fun requireValidToken(token: String) {
        require(token.length in 100..4096 && token.matches(Regex("[A-Za-z0-9:_-]+"))) {
            "Jeton de notification Android invalide."
        }
    }
}
