package cm.naxa.paymentcompanion

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.concurrent.Executors

/**
 * Processes only notifications whose title exactly matches the operator sender IDs.
 * Android grants access to the notification stream globally; filtering happens locally.
 * Notification titles are untrusted candidates and are never passed to the trusted SMS
 * capture endpoint or used as an authenticated sender address.
 */
class NaxaNotificationListenerService : NotificationListenerService() {
    companion object {
        private val EXECUTOR = Executors.newSingleThreadExecutor()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val item = sbn ?: return
        val appContext = applicationContext
        if (item.packageName == packageName) return
        val role = SecureVault.get(appContext, "companion_role")
        val consent = SecureVault.get(appContext, "notification_consent_granted") == "true"
        val extras = item.notification?.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim() ?: return
        if (!NotificationCaptureGate.canCapture(role, consent, title)) return

        val text = sequenceOf(
            extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
            extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
        ).filterNotNull().map { it.trim() }.firstOrNull { it.length >= 12 } ?: return
        if (text.length > 8000) return
        val receivedAt = item.postTime.takeIf { it > 0L } ?: System.currentTimeMillis()
        val sourcePackage = item.packageName.take(180)

        EXECUTOR.execute {
            val currentRole = SecureVault.get(appContext, "companion_role")
            val currentConsent = SecureVault.get(appContext, "notification_consent_granted") == "true"
            if (!NotificationCaptureGate.canCapture(currentRole, currentConsent, title)) return@execute
            try {
                NaxaApi.sendNotificationCandidate(appContext, title, text, sourcePackage, receivedAt)
                SecureVault.put(appContext, "last_notification_candidate_at", System.currentTimeMillis().toString())
                SecureVault.put(appContext, "last_notification_candidate_status", "manual_review")
            } catch (error: Exception) {
                try {
                    SecureVault.put(appContext, "last_notification_candidate_status", "transmission_failed")
                    SecureVault.put(appContext, "last_notification_candidate_error", (error.message ?: "Transmission indisponible").take(180))
                } catch (_: Exception) { }
            }
        }
    }
}
