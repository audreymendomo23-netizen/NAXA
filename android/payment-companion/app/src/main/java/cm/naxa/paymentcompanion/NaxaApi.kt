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
            "pharmacie" -> {
                val device = registerNotificationDevice(context, "pharmacie", null)
                SecureVault.put(context, "notification_device_id", device.getString("deviceId"))
                SecureVault.put(context, "notification_device_token", device.getString("deviceToken"))
                SecureVault.put(context, "companion_role", "pharmacie")
            }
            "partenaire" -> {
                val body = JSONObject().put("installationId", installationId).put("deviceName", deviceName)
                val response = HttpClient.post(SupabaseSession.trimSlash(base) + "/api/partenaire/paiements/device/register", access, null, body)
                val devices = response.optJSONArray("devices") ?: JSONArray()
                SecureVault.put(context, "partner_payment_devices", devices.toString())
                val notificationDevices = JSONArray()
                for (i in 0 until devices.length()) {
                    val partner = devices.optJSONObject(i) ?: continue
                    val notification = registerNotificationDevice(context, "partner", partner.optString("partnerId"))
                    notificationDevices.put(JSONObject()
                        .put("partnerId", partner.optString("partnerId"))
                        .put("deviceId", notification.getString("deviceId"))
                        .put("deviceToken", notification.getString("deviceToken")))
                }
                SecureVault.put(context, "notification_partner_devices", notificationDevices.toString())
                SecureVault.put(context, "companion_role", "partenaire")
            }
            "admin" -> {
                val device = registerNotificationDevice(context, "admin", null)
                SecureVault.put(context, "notification_device_id", device.getString("deviceId"))
                SecureVault.put(context, "notification_device_token", device.getString("deviceToken"))
                var smsReady = true
                try {
                    arrayOf("orange_money", "mtn_momo").forEach { channel ->
                        val body = JSONObject().put("installationId", installationId).put("deviceName", deviceName).put("canal", channel)
                        val response = HttpClient.post(SupabaseSession.trimSlash(base) + "/api/admin/paiements/device/register", access, null, body)
                        SecureVault.put(context, "admin_device_id_" + channel, response.getString("deviceId"))
                        SecureVault.put(context, "admin_device_token_" + channel, response.getString("deviceToken"))
                    }
                } catch (error: Exception) {
                    smsReady = false
                    SecureVault.put(context, "admin_sms_enrollment_error", (error.message ?: "Destination Admin non configurée").take(180))
                }
                SecureVault.put(context, "admin_sms_enrollment_ready", smsReady.toString())
                SecureVault.put(context, "companion_role", "admin")
            }
            else -> throw IllegalArgumentException("Rôle de compagnon non pris en charge pour l'enrôlement.")
        }
    }

    private fun registerNotificationDevice(context: Context, workspace: String, partnerId: String?): JSONObject {
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        val body = JSONObject().put("workspace", workspace)
            .put("installationId", getOrCreateInstallationId(context))
            .put("deviceName", Build.MANUFACTURER + " " + Build.MODEL)
            .put("notificationConsent", SecureVault.get(context, "notification_consent_granted") == "true")
        if (!partnerId.isNullOrBlank()) body.put("partnerId", partnerId)
        return HttpClient.post(SupabaseSession.trimSlash(base) + "/api/paiements/android-device", access, null, body)
    }

    fun setNotificationConsent(context: Context, enabled: Boolean) {
        val base = SecureVault.get(context, "naxa_base_url") ?: return
        val access = SupabaseSession.getAccessToken(context)
        val devices = JSONArray()
        val id = SecureVault.get(context, "notification_device_id")
        val token = SecureVault.get(context, "notification_device_token")
        if (!id.isNullOrBlank() && !token.isNullOrBlank()) {
            devices.put(JSONObject().put("deviceId", id).put("deviceToken", token))
        }
        val partnerDevices = JSONArray(SecureVault.get(context, "notification_partner_devices") ?: "[]")
        for (i in 0 until partnerDevices.length()) devices.put(partnerDevices.getJSONObject(i))
        for (i in 0 until devices.length()) {
            val item = devices.getJSONObject(i)
            HttpClient.post(
                SupabaseSession.trimSlash(base) + "/api/paiements/android-device/consent",
                access, null,
                JSONObject().put("deviceId", item.getString("deviceId"))
                    .put("deviceToken", item.getString("deviceToken")).put("enabled", enabled)
            )
        }
    }

    fun setSmsConsent(context: Context, enabled: Boolean) {
        val role = SecureVault.get(context, "companion_role")
        require(role == "pharmacie" || role == "partenaire") {
            "La collecte SMS automatique est réservée à Pharmacie et Partenaire."
        }
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        val devices = JSONArray()
        if (role == "pharmacie") {
            val id = SecureVault.get(context, "notification_device_id")
            val token = SecureVault.get(context, "notification_device_token")
            if (!id.isNullOrBlank() && !token.isNullOrBlank()) {
                devices.put(JSONObject().put("deviceId", id).put("deviceToken", token))
            }
        } else {
            val partnerDevices = JSONArray(SecureVault.get(context, "notification_partner_devices") ?: "[]")
            for (i in 0 until partnerDevices.length()) {
                devices.put(partnerDevices.getJSONObject(i))
            }
        }
        require(devices.length() > 0) { "Aucun téléphone professionnel enrôlé." }
        for (i in 0 until devices.length()) {
            val item = devices.getJSONObject(i)
            HttpClient.post(
                SupabaseSession.trimSlash(base) + "/api/paiements/android-device/sms-consent",
                access, null,
                JSONObject().put("deviceId", item.getString("deviceId"))
                    .put("deviceToken", item.getString("deviceToken"))
                    .put("enabled", enabled)
            )
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
        context: Context, channel: String, senderTitle: String, message: String,
        sourcePackage: String, receivedAtMillis: Long
    ) {
        val role = SecureVault.get(context, "companion_role")
        if (!NotificationCaptureGate.canCapture(
                role, SecureVault.get(context, "notification_consent_granted") == "true", sourcePackage
            )) return
        val devices = JSONArray()
        val id = SecureVault.get(context, "notification_device_id")
        val token = SecureVault.get(context, "notification_device_token")
        if (!id.isNullOrBlank() && !token.isNullOrBlank()) {
            devices.put(JSONObject().put("deviceId", id).put("deviceToken", token))
        }
        val partnerDevices = JSONArray(SecureVault.get(context, "notification_partner_devices") ?: "[]")
        for (i in 0 until partnerDevices.length()) devices.put(partnerDevices.getJSONObject(i))
        val base = SecureVault.get(context, "naxa_base_url") ?: return
        val access = SupabaseSession.getAccessToken(context)
        val text = listOf(senderTitle, message).filter { it.isNotBlank() }.joinToString(" · ").take(8000)
        for (i in 0 until devices.length()) {
            val item = devices.getJSONObject(i)
            HttpClient.post(
                SupabaseSession.trimSlash(base) + "/api/paiements/android-notifications",
                access, null,
                JSONObject().put("deviceId", item.getString("deviceId"))
                    .put("deviceToken", item.getString("deviceToken"))
                    .put("canal", channel).put("sourcePackage", sourcePackage)
                    .put("notificationText", text)
                    .put("postedAt", Instant.ofEpochMilli(receivedAtMillis).toString())
            )
        }
    }

    fun submitProfessionalSharedSms(context: Context, channel: String, smsText: String): JSONObject {
        val base = SecureVault.get(context, "naxa_base_url") ?: error("URL NAXA manquante.")
        val access = SupabaseSession.getAccessToken(context)
        val deviceId = SecureVault.get(context, "notification_device_id") ?: error("Téléphone Pharmacie non enrôlé.")
        val deviceToken = SecureVault.get(context, "notification_device_token") ?: error("Jeton téléphone manquant.")
        return HttpClient.post(
            SupabaseSession.trimSlash(base) + "/api/professionnel/paiements/share",
            access, null,
            JSONObject().put("deviceId", deviceId).put("deviceToken", deviceToken)
                .put("canal", channel).put("smsText", smsText)
        )
    }

    fun sendCapturedSms(context: Context, channel: String, sender: String?, message: String, receivedAtMillis: Long) {
        val role = SecureVault.get(context, "companion_role") ?: return
        val base = SecureVault.get(context, "naxa_base_url") ?: return
        val access = SupabaseSession.getAccessToken(context)
        val receivedAt = Instant.ofEpochMilli(receivedAtMillis).toString()

        // Keep the dedicated Promoteur-subscription/Admin reconciliation path unchanged.
        if (role == "admin") {
            val deviceId = SecureVault.get(context, "admin_device_id_" + channel) ?: return
            val deviceToken = SecureVault.get(context, "admin_device_token_" + channel) ?: return
            val body = JSONObject().put("deviceId", deviceId).put("deviceToken", deviceToken)
                .put("canal", channel).put("smsText", message).put("senderOriginAddress", sender)
                .put("smsReceivedAt", receivedAt)
            val response = HttpClient.post(SupabaseSession.trimSlash(base) + "/api/admin/paiements/capture", access, null, body)
            SecureVault.put(context, "last_capture_status", response.optString("status", "received"))
            SecureVault.put(context, "last_capture_at", System.currentTimeMillis().toString())
            return
        }

        if (role != "pharmacie" && role != "partenaire") return
        val devices = JSONArray()
        if (role == "pharmacie") {
            val deviceId = SecureVault.get(context, "notification_device_id")
            val deviceToken = SecureVault.get(context, "notification_device_token")
            if (!deviceId.isNullOrBlank() && !deviceToken.isNullOrBlank()) {
                devices.put(JSONObject().put("deviceId", deviceId).put("deviceToken", deviceToken))
            }
        } else {
            val partnerDevices = JSONArray(SecureVault.get(context, "notification_partner_devices") ?: "[]")
            for (i in 0 until partnerDevices.length()) devices.put(partnerDevices.getJSONObject(i))
        }
        if (devices.length() == 0) return

        var submitted = 0
        for (i in 0 until devices.length()) {
            val item = devices.getJSONObject(i)
            val body = JSONObject().put("deviceId", item.getString("deviceId"))
                .put("deviceToken", item.getString("deviceToken"))
                .put("canal", channel).put("smsText", message)
                .put("senderOriginAddress", sender).put("smsReceivedAt", receivedAt)
            HttpClient.post(SupabaseSession.trimSlash(base) + "/api/paiements/android-sms", access, null, body)
            submitted++
        }
        SecureVault.put(context, "last_capture_status", if (submitted > 0) "received_for_matching" else "not_enrolled")
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
