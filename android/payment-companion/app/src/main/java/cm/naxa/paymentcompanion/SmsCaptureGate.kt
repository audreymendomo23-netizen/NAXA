package cm.naxa.paymentcompanion

/**
 * Defense-in-depth: only the Admin build and Admin account can process
 * incoming SMS, after both in-app consent and Android permission are granted.
 */
object SmsCaptureGate {
    fun canCapture(
        role: String?,
        explicitConsent: Boolean,
        runtimePermissionGranted: Boolean,
        channel: String?
    ): Boolean {
        if (role != "admin" || !explicitConsent || !runtimePermissionGranted) return false
        return channel == "orange_money" || channel == "mtn_momo"
    }
}
