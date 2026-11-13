package cm.naxa.paymentcompanion

/**
 * Defense-in-depth gate: SMS content is processed only after explicit in-app
 * consent, Android runtime permission, and a strictly recognized operator ID.
 */
object SmsCaptureGate {
    fun canCapture(
        explicitConsent: Boolean,
        runtimePermissionGranted: Boolean,
        channel: String?
    ): Boolean {
        if (!explicitConsent || !runtimePermissionGranted) return false
        return channel == "orange_money" || channel == "mtn_momo"
    }
}
