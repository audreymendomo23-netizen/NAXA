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


    suspend fun ensureNativeDevice(userId: String, deviceKey: String, deviceName: String, platformDeviceId: String, serviceUuid: String, characteristicUuid: String): String = withContext(Dispatchers.IO) {
        val token = tokenStore.read()?.first ?: throw IOException("Session NAXA absente.")
        requireConfigured()
        require(deviceKey.isNotBlank() && platformDeviceId.isNotBlank()) { "Identifiant d’appareil incomplet." }
        val encodedUser = URLEncoder.encode(userId, Charsets.UTF_8.name())
        val encodedPlatformId = URLEncoder.encode(platformDeviceId, Charsets.UTF_8.name())
        val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
        val existingId = findNativeDeviceId(token, baseUrl, encodedUser, encodedPlatformId)
        val now = java.time.Instant.now().toString()
        val safeName = deviceName.trim().ifBlank { "Appareil Bluetooth" }.take(120).let { if (it.length < 2) "Appareil Bluetooth" else it }
        val body = JSONObject()
            .put("user_id", userId).put("device_key", deviceKey).put("device_name", safeName)
            .put("connection_mode", "bluetooth").put("active", true)
            .put("capabilities", JSONArray().put("bluetooth").put("manual").put("scan"))
            .put("platform_device_id", platformDeviceId).put("device_model", safeName)
            .put("protocol", "$serviceUuid/$characteristicUuid".take(80))
            .put("connection_state", "connected").put("auto_reconnect", true)
            .put("background_supported", true).put("last_seen_at", now)
            .put("last_error", JSONObject.NULL).put("updated_at", now)
        if (existingId != null) {
            body.remove("user_id"); body.remove("device_key"); body.remove("platform_device_id")
            val request = Request.Builder()
                .url("$baseUrl/rest/v1/suivi_user_devices?id=eq.$existingId&user_id=eq.$encodedUser")
                .header("apikey", BuildConfig.SUPABASE_ANON_KEY).header("Authorization", "Bearer $token")
                .header("Content-Type", "application/json").header("Prefer", "return=minimal")
                .patch(body.toString().toRequestBody(jsonType)).build()
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw IOException("Mise à jour de l’appareil impossible (HTTP ${response.code}).")
            }
            existingId
        } else {
            val request = Request.Builder()
                .url("$baseUrl/rest/v1/suivi_user_devices")
                .header("apikey", BuildConfig.SUPABASE_ANON_KEY).header("Authorization", "Bearer $token")
                .header("Content-Type", "application/json").header("Prefer", "return=representation")
                .post(body.toString().toRequestBody(jsonType)).build()
            http.newCall(request).execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    if (response.code == 409) {
                        findNativeDeviceId(token, baseUrl, encodedUser, encodedPlatformId)
                            ?: throw IOException("Enregistrement de l’appareil en conflit (HTTP 409).")
                    } else throw IOException("Enregistrement de l’appareil impossible (HTTP ${response.code}).")
                } else {
                    JSONArray(responseBody).optJSONObject(0)?.optString("id")?.takeIf { it.isNotBlank() }
                        ?: throw IOException("Supabase n’a pas retourné l’identifiant de l’appareil.")
                }
            }
        }
    }

    private fun findNativeDeviceId(token: String, baseUrl: String, encodedUser: String, encodedPlatformId: String): String? {
        val request = Request.Builder()
            .url("$baseUrl/rest/v1/suivi_user_devices?select=id&user_id=eq.$encodedUser&platform_device_id=eq.$encodedPlatformId&limit=1")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY).header("Authorization", "Bearer $token").get().build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Lecture de l’appareil impossible (HTTP ${response.code}).")
            return JSONArray(response.body?.string().orEmpty()).optJSONObject(0)?.optString("id")
                ?.takeIf { it.isNotBlank() && it != "null" }
        }
    }

    suspend fun persistNativeMeasurements(userId: String, deviceId: String, eventId: String, deviceName: String, measurements: List<NativeGattMeasurement>) = withContext(Dispatchers.IO) {
        if (measurements.isEmpty()) return@withContext
        val token = tokenStore.read()?.first ?: throw IOException("Session NAXA absente.")
        requireConfigured()
        require(eventId.isNotBlank()) { "Identifiant d’événement BLE absent." }
        val receivedAt = java.time.Instant.now().toString()
        val eventKeys = measurements.indices.map { "$eventId:$it" }
        val rows = JSONArray()
        measurements.forEachIndexed { index, measurement ->
            rows.put(JSONObject()
                .put("user_id", userId).put("device_id", deviceId)
                .put("measurement_type", measurement.measurementType).put("value_numeric", measurement.value)
                .put("value_text", JSONObject.NULL).put("unit", measurement.unit)
                .put("measured_at", measurement.measuredAt ?: receivedAt).put("received_at", receivedAt)
                .put("device_event_id", eventKeys[index]).put("sync_origin", "android_native")
                .put("source", "bluetooth").put("device_model_snapshot", deviceName.take(120))
                .put("device_brand_snapshot", JSONObject.NULL).put("note", JSONObject.NULL))
        }
        val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
        val insert = Request.Builder()
            .url("$baseUrl/rest/v1/suivi_measurements")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY).header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json").header("Prefer", "return=minimal")
            .post(rows.toString().toRequestBody(jsonType)).build()
        http.newCall(insert).execute().use { response ->
            if (!response.isSuccessful) {
                if (response.code != 409) throw IOException("Insertion des mesures impossible (HTTP ${response.code}).")
                val filter = URLEncoder.encode("in.(${eventKeys.joinToString(",")})", Charsets.UTF_8.name())
                val encodedUser = URLEncoder.encode(userId, Charsets.UTF_8.name())
                val verify = Request.Builder()
                    .url("$baseUrl/rest/v1/suivi_measurements?select=device_event_id&user_id=eq.$encodedUser&device_id=eq.$deviceId&device_event_id=$filter")
                    .header("apikey", BuildConfig.SUPABASE_ANON_KEY).header("Authorization", "Bearer $token").get().build()
                http.newCall(verify).execute().use { check ->
                    if (!check.isSuccessful) throw IOException("Vérification du doublon impossible (HTTP ${check.code}).")
                    val persisted = JSONArray(check.body?.string().orEmpty())
                    val existing = (0 until persisted.length()).mapNotNull { persisted.optJSONObject(it)?.optString("device_event_id") }.toSet()
                    if (!existing.containsAll(eventKeys)) throw IOException("Le conflit d’insertion ne correspond pas à un doublon complet.")
                }
            }
        }
        val devicePatch = JSONObject()
            .put("last_sync_at", receivedAt).put("last_measurement_at", receivedAt).put("last_seen_at", receivedAt)
            .put("connection_state", "connected").put("last_error", JSONObject.NULL).put("updated_at", receivedAt)
        val encodedUser = URLEncoder.encode(userId, Charsets.UTF_8.name())
        val update = Request.Builder()
            .url("$baseUrl/rest/v1/suivi_user_devices?id=eq.$deviceId&user_id=eq.$encodedUser")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY).header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json").header("Prefer", "return=minimal")
            .patch(devicePatch.toString().toRequestBody(jsonType)).build()
        http.newCall(update).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Mise à jour de la synchronisation impossible (HTTP ${response.code}).")
        }
    }

    private fun requireConfigured() {
        if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            throw IOException("Configuration Supabase Android absente.")
        }
    }
}
