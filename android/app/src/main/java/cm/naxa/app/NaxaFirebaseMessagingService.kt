package cm.naxa.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class NaxaFirebaseMessagingService : FirebaseMessagingService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN_KEY, token).apply()
        serviceScope.launch {
            try {
                FcmRegistrationRepository(applicationContext, SecureTokenStore(applicationContext)).register(token)
            } catch (_: Exception) {
                // Registration is retried after the next successful app sign-in/settings visit.
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        val title = data["title"]?.take(80)?.ifBlank { null } ?: "Notification NAXA"
        val body = data["body"]?.take(180)?.ifBlank { null } ?: "Une nouvelle notification vous attend."
        val path = data["url"]?.takeIf { it.startsWith("/") && !it.startsWith("//") && !it.contains("://") } ?: "/notifications"
        val tag = data["tag"]?.take(120) ?: "naxa-fcm"
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel(
                CHANNEL, "Alertes et rappels NAXA", NotificationManager.IMPORTANCE_HIGH
            ).apply { description = "Alertes et rappels envoyés par NAXA." })
        }
        val open = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("openPath", path)
        }
        val pending = PendingIntent.getActivity(
            this, tag.hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = if (Build.VERSION.SDK_INT >= 26) {
            Notification.Builder(this, CHANNEL)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }.setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title).setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(pending).setAutoCancel(true).build()
        manager.notify(tag.hashCode(), notification)
    }

    companion object {
        const val PREFS = "naxa_firebase"
        const val TOKEN_KEY = "fcm_token"
        private const val CHANNEL = "naxa_fcm_alerts"
    }
}
