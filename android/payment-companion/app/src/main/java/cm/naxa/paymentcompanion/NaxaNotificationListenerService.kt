package cm.naxa.paymentcompanion

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.concurrent.Executors

/**
 * Android notification access is broad; NAXA filters locally by the exact
 * payment-app package allowlist and transmits no unrelated notifications.
 */
class NaxaNotificationListenerService : NotificationListenerService() {
    companion object {
        private val EXECUTOR = Executors.newSingleThreadExecutor()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val item = sbn ?: return
        val sourcePackage = item.packageName
        if (sourcePackage == packageName) return
        val appContext = applicationContext
        val role = SecureVault.get(appContext, "companion_role")
        val consent = SecureVault.get(appContext, "notification_consent_granted") == "true"
        val channel = NotificationCaptureGate.channelFromSourcePackage(sourcePackage) ?: return
        if (!NotificationCaptureGate.canCapture(role, consent, sourcePackage)) return

        val extras = item.notification?.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        val text = buildString {
            append(extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty())
            append(" ")
            append(extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty())
            extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.forEach {
                append(" ")
                append(it?.toString().orEmpty())
            }
        }.trim()
        if (text.length !in 12..8000) return
        val receivedAt = item.postTime.takeIf { it > 0L } ?: System.currentTimeMillis()

        EXECUTOR.execute {
            val currentRole = SecureVault.get(appContext, "companion_role")
            val currentConsent = SecureVault.get(appContext, "notification_consent_granted") == "true"
            if (!NotificationCaptureGate.canCapture(currentRole, currentConsent, sourcePackage)) return@execute
            try {
                NaxaApi.sendNotificationCandidate(appContext, channel, title, text, sourcePackage, receivedAt)
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
