package cm.naxa.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class NaxaNotificationItem(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val threadId: String?,
    val pharmacyId: String?,
    val reservationId: String?,
    val relatedEntityId: String?,
    val readAt: String?,
    val createdAt: String
)

class NativeNotificationsRepository(private val tokenStore: SecureTokenStore) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun load(): List<NaxaNotificationItem> = withContext(Dispatchers.IO) {
        val token = accessToken()
        val base = supabaseBaseUrl()
        val url = base.toHttpUrl().newBuilder()
            .addPathSegments("rest/v1/notifications")
            .addQueryParameter(
                "select",
                "id,type,titre,corps,fil_id,pharmacie_id,reservation_id,related_entity_id,lu_le,created_at"
            )
            .addQueryParameter("order", "created_at.desc")
            .addQueryParameter("limit", "50")
            .build()

        val request = Request.Builder()
            .url(url)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .header("Cache-Control", "no-store")
            .get()
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException(errorMessage(response.code))
            }
            val rows = try {
                JSONArray(raw)
            } catch (_: Exception) {
                throw IOException("Réponse des notifications NAXA illisible.")
            }
            buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    val id = row.optString("id")
                    if (!isNaxaUuid(id)) continue
                    add(
                        NaxaNotificationItem(
                            id = id,
                            type = row.optString("type", "notification"),
                            title = row.optString("titre", "Notification NAXA"),
                            body = row.optString("corps"),
                            threadId = row.nullableString("fil_id"),
                            pharmacyId = row.nullableString("pharmacie_id"),
                            reservationId = row.nullableString("reservation_id"),
                            relatedEntityId = row.nullableString("related_entity_id"),
                            readAt = row.nullableString("lu_le"),
                            createdAt = row.optString("created_at")
                        )
                    )
                }
            }
        }
    }

    suspend fun markRead(notificationId: String): Boolean = withContext(Dispatchers.IO) {
        require(isNaxaUuid(notificationId)) { "Identifiant de notification invalide." }
        val token = accessToken()
        val url = supabaseBaseUrl().toHttpUrl().newBuilder()
            .addPathSegments("rest/v1/rpc/mark_user_notification_read")
            .build()
        val body = JSONObject()
            .put("p_notification_id", notificationId)
            .toString()
            .toRequestBody(JSON_MEDIA_TYPE)
        val request = Request.Builder()
            .url(url)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header("Cache-Control", "no-store")
            .post(body)
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IOException(errorMessage(response.code))
            raw.trim().equals("true", ignoreCase = true)
        }
    }

    private fun accessToken(): String {
        if (BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            throw IOException("Configuration Supabase Android indisponible.")
        }
        return tokenStore.read()?.first
            ?: throw IOException("Reconnectez-vous pour consulter les notifications.")
    }

    private fun supabaseBaseUrl(): String {
        val value = BuildConfig.SUPABASE_URL.trimEnd('/')
        if (value.isBlank()) throw IOException("Adresse Supabase Android indisponible.")
        return value
    }

    private fun errorMessage(status: Int): String = when (status) {
        401 -> "Session expirée. Reconnectez-vous."
        403 -> "Accès aux notifications refusé par les règles de sécurité NAXA."
        404 -> "Service des notifications indisponible dans cet environnement."
        else -> "Chargement des notifications impossible (HTTP $status)."
    }

    private companion object {
        val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}

private fun JSONObject.nullableString(key: String): String? =
    if (isNull(key) || !has(key)) null else optString(key).takeIf { it.isNotBlank() && it != "null" }
