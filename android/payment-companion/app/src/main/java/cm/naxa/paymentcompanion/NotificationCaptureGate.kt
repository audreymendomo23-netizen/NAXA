package cm.naxa.paymentcompanion

/** Notification reader is limited to Pharmacy, Partner and Admin profiles. */
object NotificationCaptureGate {
    fun channelFromSourcePackage(packageName: String?): String? =
        PaymentNotificationSourceClassifier.channelFromPackage(packageName)

    fun canCapture(role: String?, explicitConsent: Boolean, sourcePackage: String?): Boolean {
        if (!explicitConsent || role !in setOf("pharmacie", "partenaire", "admin")) return false
        return channelFromSourcePackage(sourcePackage) != null
    }
}
