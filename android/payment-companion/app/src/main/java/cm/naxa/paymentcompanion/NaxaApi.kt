package cm.naxa.paymentcompanion

import android.content.Context
import android.os.Build
import org.json.JSONArray
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
            else -> throw IllegalArgumentException("Rôle de compagnon non pris en charge pour l'enrôlement.")
        }
    }

    fun preparePromoterPayment(context: Context, channel: String): JSONObject {
        require(channel == "orange_money" || channel == "mtn_momo") { "Canal de paiement invalide." }
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        val deviceId = SecureVault.get(context, "promoteur_device_id") ?: error("Téléphone Promoteur non enrôlé.")
        val deviceToken = SecureVault.get(context, "promoteur_device_token") ?: error("Jeton Promoteur manquant.")
        val response = HttpClient.post(
            SupabaseSession.trimSlash(base) + "/api/promoteur/paiements/intent",
            access, null, JSONObject().put("canal", channel),
            mapOf("x-naxa-device-id" to deviceId, "x-naxa-device-token" to deviceToken)
        )
        val intent = response.optJSONObject("intent") ?: error("Intention de paiement absente.")
        SecureVault.put(context, "promoteur_intent_id", intent.getString("id"))
        SecureVault.put(context, "promoteur_intent_channel", channel)
        SecureVault.put(context, "promoteur_expected_amount", intent.getInt("expected_amount").toString())
        SecureVault.put(context, "promoteur_intent_expires_at", intent.optString("expires_at"))
        return intent
    }

    fun clientPendingDeliveryPayments(context: Context): JSONArray {
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        return HttpClient.get(SupabaseSession.trimSlash(base) + "/api/client/paiements/livraison/pending", access)
            .optJSONArray("orders") ?: JSONArray()
    }

    fun submitClientPayment(
        context: Context, reservationId: String, channel: String, smsText: String?,
        payerNumber: String, amount: Int, paidAt: String, reference: String,
        fieldSources: JSONObject
    ): JSONObject {
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        val body = JSONObject()
            .put("reservationId", reservationId)
            .put("canal", channel)
            .put("smsText", smsText ?: "")
            .put("payerNumber", payerNumber)
            .put("amount", amount)
            .put("paidAt", paidAt)
            .put("reference", reference)
            .put("fieldSources", fieldSources)
        return HttpClient.post(SupabaseSession.trimSlash(base) + "/api/client/paiements/livraison/share", access, null, body)
    }

    fun submitPromoterPayment(
        context: Context, channel: String, smsText: String?,
        payerNumber: String, amount: Int, paidAt: String, reference: String
    ): JSONObject {
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        val deviceId = SecureVault.get(context, "promoteur_device_id") ?: error("Téléphone Promoteur non enrôlé.")
        val deviceToken = SecureVault.get(context, "promoteur_device_token") ?: error("Jeton Promoteur manquant.")
        val body = JSONObject()
            .put("deviceId", deviceId).put("deviceToken", deviceToken)
            .put("canal", channel).put("smsText", smsText ?: "")
            .put("payerNumber", payerNumber).put("amount", amount)
            .put("paidAt", paidAt).put("reference", reference)
        return HttpClient.post(SupabaseSession.trimSlash(base) + "/api/promoteur/paiements/share", access, null, body)
    }

    fun submitAdminSharedSms(context: Context, channel: String, smsText: String): JSONObject {
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        val deviceId = SecureVault.get(context, "admin_device_id_" + channel) ?: error("Téléphone Admin non enrôlé pour ce canal.")
        val deviceToken = SecureVault.get(context, "admin_device_token_" + channel) ?: error("Jeton Admin manquant.")
        val body = JSONObject().put("deviceId", deviceId).put("deviceToken", deviceToken)
            .put("canal", channel).put("smsText", smsText)
        return HttpClient.post(SupabaseSession.trimSlash(base) + "/api/admin/paiements/share", access, null, body)
    }

    fun sendCapturedSms(context: Context, channel: String, sender: String?, message: String, receivedAtMillis: Long) {
        if (SecureVault.get(context, "companion_role") != "admin") return
        val base = SecureVault.get(context, "naxa_base_url") ?: return
        val access = SupabaseSession.getAccessToken(context)
        val deviceId = SecureVault.get(context, "admin_device_id_" + channel) ?: return
        val deviceToken = SecureVault.get(context, "admin_device_token_" + channel) ?: return
        val body = JSONObject().put("deviceId", deviceId).put("deviceToken", deviceToken)
            .put("canal", channel).put("smsText", message).put("senderOriginAddress", sender)
            .put("smsReceivedAt", Instant.ofEpochMilli(receivedAtMillis).toString())
        val response = HttpClient.post(SupabaseSession.trimSlash(base) + "/api/admin/paiements/capture", access, null, body)
        SecureVault.put(context, "last_capture_status", response.optString("status", "received"))
        SecureVault.put(context, "last_capture_at", System.currentTimeMillis().toString())
    }

    private fun getOrCreateInstallationId(context: Context): String {
        var id = SecureVault.get(context, "installation_id")
        if (id == null || id.length < 36) {
            id = UUID.randomUUID().toString()
            SecureVault.put(context, "installation_id", id)
        }
        return id
    }
}
