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
            "partenaire" -> {
                val body = JSONObject().put("installationId", installationId).put("deviceName", deviceName)
                val response = HttpClient.post(SupabaseSession.trimSlash(base) + "/api/partenaire/paiements/device/register", access, null, body)
                SecureVault.put(context, "partner_payment_devices", response.optJSONArray("devices")?.toString() ?: "[]")
                SecureVault.put(context, "companion_role", "partenaire")
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
        payerNumber: String, amount: Int, paidAt: String, reference: String,
        sourceType: String = "voluntary_sms_share", senderTitle: String? = null, smsReceivedAt: String? = null
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
            .put("sourceType", sourceType)
        if (!senderTitle.isNullOrBlank()) body.put("senderTitle", senderTitle)
        if (!smsReceivedAt.isNullOrBlank()) body.put("smsReceivedAt", smsReceivedAt)
        return HttpClient.post(SupabaseSession.trimSlash(base) + "/api/promoteur/paiements/share", access, null, body)
    }

    fun submitAdminSharedSms(
        context: Context, channel: String, smsText: String,
        sourceType: String = "voluntary_sms_share", senderTitle: String? = null
    ): JSONObject {
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        val deviceId = SecureVault.get(context, "admin_device_id_" + channel) ?: error("Téléphone Admin non enrôlé pour ce canal.")
        val deviceToken = SecureVault.get(context, "admin_device_token_" + channel) ?: error("Jeton Admin manquant.")
        val body = JSONObject().put("deviceId", deviceId).put("deviceToken", deviceToken)
            .put("canal", channel).put("smsText", smsText).put("sourceType", sourceType)
        if (!senderTitle.isNullOrBlank()) body.put("senderTitle", senderTitle)
        return HttpClient.post(SupabaseSession.trimSlash(base) + "/api/admin/paiements/share", access, null, body)
    }

    fun submitPartnerSmsCandidate(
        context: Context, partnerId: String, deviceId: String, deviceToken: String,
        channel: String, smsText: String, sourceType: String,
        senderTitle: String? = null, sourcePackage: String? = null, receivedAt: String? = null
    ): JSONObject {
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        val body = JSONObject()
            .put("partnerId", partnerId).put("deviceId", deviceId).put("deviceToken", deviceToken)
            .put("canal", channel).put("smsText", smsText).put("sourceType", sourceType)
            .put("receivedAt", receivedAt ?: Instant.now().toString())
        if (!senderTitle.isNullOrBlank()) body.put("senderTitle", senderTitle)
        if (!sourcePackage.isNullOrBlank()) body.put("sourcePackage", sourcePackage)
        return HttpClient.post(SupabaseSession.trimSlash(base) + "/api/partenaire/paiements/notification-candidate", access, null, body)
    }

    private fun submitPromoterNotificationCandidate(
        context: Context, channel: String, senderTitle: String, message: String, sourcePackage: String, receivedAt: String
    ): JSONObject {
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        val deviceId = SecureVault.get(context, "promoteur_device_id") ?: error("Téléphone Promoteur non enrôlé.")
        val deviceToken = SecureVault.get(context, "promoteur_device_token") ?: error("Jeton Promoteur manquant.")
        val body = JSONObject().put("deviceId", deviceId).put("deviceToken", deviceToken)
            .put("canal", channel).put("senderTitle", senderTitle).put("notificationText", message)
            .put("sourcePackage", sourcePackage).put("receivedAt", receivedAt)
        return HttpClient.post(SupabaseSession.trimSlash(base) + "/api/promoteur/paiements/notification-candidate", access, null, body)
    }

    fun sendNotificationCandidate(
        context: Context, senderTitle: String, message: String, sourcePackage: String, receivedAtMillis: Long
    ) {
        val role = SecureVault.get(context, "companion_role")
        val channel = NotificationCaptureGate.channelFromTitle(senderTitle) ?: return
        if (!NotificationCaptureGate.canCapture(role, SecureVault.get(context, "notification_consent_granted") == "true", senderTitle)) return
        val receivedAt = Instant.ofEpochMilli(receivedAtMillis).toString()
        when (role) {
            "admin" -> submitAdminSharedSms(context, channel, message, "notification_listener_candidate", senderTitle)
            "promoteur" -> submitPromoterNotificationCandidate(context, channel, senderTitle, message, sourcePackage, receivedAt)
            "partenaire" -> {
                val devices = JSONArray(SecureVault.get(context, "partner_payment_devices") ?: "[]")
                for (i in 0 until devices.length()) {
                    val item = devices.optJSONObject(i) ?: continue
                    submitPartnerSmsCandidate(
                        context, item.optString("partnerId"), item.optString("deviceId"),
                        item.optString("deviceToken"), channel, message,
                        "notification_listener_candidate", senderTitle, sourcePackage, receivedAt
                    )
                }
            }
        }
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
