package cm.naxa.paymentcompanion

/**
 * Defense-in-depth: only Admin, Pharmacy and Partner accounts can process
 * incoming payment SMS after separate in-app consent and Android permission.
 * Client and Promoteur accounts never receive background SMS capture.
 */
object SmsCaptureGate {
    fun canCapture(
        role: String?,
        explicitConsent: Boolean,
        runtimePermissionGranted: Boolean,
        channel: String?
    ): Boolean {
        if (role !in setOf("admin", "pharmacie", "partenaire") ||
            !explicitConsent || !runtimePermissionGranted) return false
        return channel == "orange_money" || channel == "mtn_momo"
    }
}
