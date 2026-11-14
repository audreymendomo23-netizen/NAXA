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
import java.util.concurrent.TimeUnit

internal data class CourierMission(
    val id: String,
    val reservationId: String,
    val status: String,
    val createdAt: String?,
    val readyAt: String?,
    val acceptedAt: String?,
    val pickedUpAt: String?,
    val deliveredAt: String?,
    val city: String?,
    val district: String?,
    val address: String?,
    val landmark: String?,
    val phone: String?,
    val paymentMode: String?,
    val paymentStatus: String?,
    val orderTotal: Long?,
    val deliveryFee: Long?
)

internal class CourierRepository(private val tokenStore: SecureTokenStore) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun missions(includeHistory: Boolean = false): List<CourierMission> = withContext(Dispatchers.IO) {
        val result = rpc("naxa_delivery_my_missions", JSONObject().put("p_include_history", includeHistory))
        val rows = when (result) {
            is JSONArray -> result
            is JSONObject -> result.optJSONArray("missions") ?: JSONArray()
            else -> JSONArray()
        }
        buildList {
            for (i in 0 until rows.length()) {
                val row = rows.optJSONObject(i) ?: continue
                val id = row.optString("id")
                val reservationId = row.optString("reservation_id")
                if (!isNaxaUuid(id) || !isNaxaUuid(reservationId)) continue
                add(CourierMission(
                    id = id,
                    reservationId = reservationId,
                    status = row.optString("statut"),
                    createdAt = row.stringOrNull("created_at"),
                    readyAt = row.stringOrNull("ready_at"),
                    acceptedAt = row.stringOrNull("accepted_at"),
                    pickedUpAt = row.stringOrNull("picked_up_at"),
                    deliveredAt = row.stringOrNull("delivered_at"),
                    city = row.stringOrNull("ville"),
                    district = row.stringOrNull("quartier"),
                    address = row.stringOrNull("adresse"),
                    landmark = row.stringOrNull("repere"),
                    phone = row.stringOrNull("telephone"),
                    paymentMode = row.stringOrNull("paiement_mode"),
                    paymentStatus = row.stringOrNull("paiement_statut"),
                    orderTotal = row.longOrNull("total"),
                    deliveryFee = row.longOrNull("frais_livraison")
                ))
            }
        }
    }

    suspend fun accept(missionId: String) = withContext(Dispatchers.IO) {
        require(isNaxaUuid(missionId)) { "Identifiant de mission invalide." }
        rpc("naxa_delivery_accept", JSONObject().put("p_mission", missionId))
    }

    suspend fun pickup(missionId: String) = withContext(Dispatchers.IO) {
        require(isNaxaUuid(missionId)) { "Identifiant de mission invalide." }
        rpc("naxa_delivery_pickup", JSONObject()
            .put("p_mission", missionId)
            .put("p_latitude", JSONObject.NULL)
            .put("p_longitude", JSONObject.NULL)
            .put("p_accuracy_m", JSONObject.NULL))
    }

    private fun rpc(name: String, payload: JSONObject): Any? {
        val token = tokenStore.read()?.first ?: throw IOException("Reconnectez-vous pour accéder à l’espace Livreur.")
        if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            throw IOException("Configuration Supabase Android indisponible.")
        }
        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/rest/v1/rpc/$name")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = try {
                    JSONObject(raw).optString("message").ifBlank { JSONObject(raw).optString("hint") }
                } catch (_: Exception) { "" }
                throw IOException(message.ifBlank { "Opération Livreur impossible (HTTP ${response.code})." })
            }
            if (raw.isBlank()) return null
            return try { JSONArray(raw) } catch (_: Exception) {
                try { JSONObject(raw) } catch (_: Exception) { raw.trim().toBooleanStrictOrNull() }
            }
        }
    }
}

private fun JSONObject.stringOrNull(key: String): String? =
    if (isNull(key) || !has(key)) null else optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun JSONObject.longOrNull(key: String): Long? =
    if (isNull(key) || !has(key)) null else optLong(key).takeIf { it >= 0L }
