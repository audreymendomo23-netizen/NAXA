package cm.naxa.paymentcompanion

/**
 * Notification access is an Android special access. It is intentionally denied
 * to Clients even if a stale consent value exists on the device.
 */
object NotificationCaptureGate {
    fun channelFromTitle(title: String?): String? = when (title?.trim()) {
        "OrangeMoney" -> "orange_money"
        "MobileMoney" -> "mtn_momo"
        else -> null
    }

    fun canCapture(role: String?, explicitConsent: Boolean, senderTitle: String?): Boolean {
        if (!explicitConsent || role !in listOf("promoteur", "partenaire", "admin")) return false
        return channelFromTitle(senderTitle) != null
    }
}
