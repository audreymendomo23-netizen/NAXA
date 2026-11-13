package cm.naxa.paymentcompanion
import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

object NaxaApi {
    fun enroll(context: Context, role: String) {
        val base = SecureVault.get(context, "naxa_base_url")
        val access = SupabaseSession.getAccessToken(context)
        val installationId = getOrCreateInstallationId(context)
        val deviceName = Build.MANUFACTURER + " " + Build.MODEL
        require(base != null && base.startsWith("https://")) { "URL HTTPS de NAXA manquante." }
        when (role) {
            "promoteur" -> {
                val body = JSONObject().put("installationId", installationId).put("deviceName", deviceName)
                val response = HttpClient.post(SupabaseSession.trimSlash(base) + "/api/promoteur/paiements/device/register", access, null, body)
                SecureVault.put(context, "promoteur_device_id", response.getString("deviceId"))
                SecureVault.put(context, "promoteur_device_token", response.getString("deviceToken"))
                SecureVault.put(context, "companion_role", "promoteur")
            }
            "admin" -> {
                arrayOf("orange_money", "mtn_momo").forEach { channel ->
                    val body = JSONObject().put("installationId", installationId).put("deviceName", deviceName).put("canal", channel)
                    val response = HttpClient.post(SupabaseSession.trimSlash(base) + "/api/admin/paiements/device/register", access, null, body)
                    SecureVault.put(context, "admin_device_id_" + channel, response.getString("deviceId"))
                    SecureVault.put(context, "admin_device_token_" + channel, response.getString("deviceToken"))
                }
                SecureVault.put(context, "companion_role", "admin")
            }
            else -> throw IllegalArgumentException("Role non pris en charge.")
        }
    }
    private fun getOrCreateInstallationId(context: Context): String {
        var id = SecureVault.get(context, "installation_id")
        if (id == null || id.length < 36) {
            id = UUID.randomUUID().toString()
            SecureVault.put(context, "installation_id", id)
        }
        return id
    }
    fun sendCapturedSms(context: Context, channel: String, sender: String?, message: String, receivedAtMillis: Long) {
        val role = SecureVault.get(context, "companion_role")
        val base = SecureVault.get(context, "naxa_base_url")
        val access = SupabaseSession.getAccessToken(context)
        if (role == null || base == null) return
        val path: String
        val deviceId: String?
        val deviceToken: String?
        when (role) {
            "promoteur" -> {
                path = "/api/promoteur/paiements/capture"
                deviceId = SecureVault.get(context, "promoteur_device_id")
                deviceToken = SecureVault.get(context, "promoteur_device_token")
            }
            "admin" -> {
                path = "/api/admin/paiements/capture"
                deviceId = SecureVault.get(context, "admin_device_id_" + channel)
                deviceToken = SecureVault.get(context, "admin_device_token_" + channel)
            }
            else -> return
        }
        if (deviceId == null || deviceToken == null) return
        val body = JSONObject().put("deviceId", deviceId).put("deviceToken", deviceToken)
            .put("canal", channel).put("smsText", message).put("senderOriginAddress", sender)
            .put("smsReceivedAt", Instant.ofEpochMilli(receivedAtMillis).toString())
        val response = HttpClient.post(SupabaseSession.trimSlash(base) + path, access, null, body)
        SecureVault.put(context, "last_capture_status", response.optString("status", "received"))
        SecureVault.put(context, "last_capture_at", System.currentTimeMillis().toString())
    }
}
