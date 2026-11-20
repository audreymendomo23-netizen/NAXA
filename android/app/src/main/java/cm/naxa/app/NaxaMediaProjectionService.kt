package cm.naxa.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Visible foreground lifecycle for a native Support call.
 * Audio-only calls declare MICROPHONE; MediaProjection is added only after
 * the user has granted the one-session Android capture prompt.
 */
class NaxaMediaProjectionService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_AUDIO -> startForegroundSession(includeProjection = false)
            ACTION_START_PROJECTION -> startForegroundSession(includeProjection = true)
            else -> stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun startForegroundSession(includeProjection: Boolean) {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Assistance NAXA", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle(
                if (includeProjection) "Partage d’écran NAXA actif" else "Appel audio NAXA en cours"
            )
            .setContentText(
                if (includeProjection) {
                    "Votre écran est transmis uniquement à l’Agent d’assistance autorisé."
                } else {
                    "Le microphone est utilisé pour votre appel d’assistance NAXA."
                }
            )
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val types = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                if (includeProjection) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION else 0
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, types)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "naxa-support-media-projection"
        private const val NOTIFICATION_ID = 7412
        private const val ACTION_START_AUDIO = "cm.naxa.app.action.START_SUPPORT_AUDIO"
        private const val ACTION_START_PROJECTION = "cm.naxa.app.action.START_SUPPORT_PROJECTION"

        private fun start(context: Context, action: String) {
            val intent = Intent(context, NaxaMediaProjectionService::class.java).setAction(action)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
            else context.startService(intent)
        }

        fun startAudio(context: Context) = start(context, ACTION_START_AUDIO)

        /** Called only after createScreenCaptureIntent() returned RESULT_OK. */
        fun startProjection(context: Context) = start(context, ACTION_START_PROJECTION)

        /** Drop the projection type while keeping the microphone call alive. */
        fun stopProjection(context: Context) {
            context.startService(
                Intent(context, NaxaMediaProjectionService::class.java).setAction(ACTION_START_AUDIO)
            )
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, NaxaMediaProjectionService::class.java))
        }
    }
}
