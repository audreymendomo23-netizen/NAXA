package cm.naxa.app

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.ResultReceiver
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Visible foreground lifecycle for a native Support call.
 * Audio-only calls declare MICROPHONE; MediaProjection is added only after
 * the user has granted the one-session Android capture prompt.
 *
 * The start helpers suspend until onStartCommand has synchronously called
 * startForeground(). Capture is never initialized on a best-effort race.
 */
class NaxaMediaProjectionService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val resultReceiver = intent?.let {
            IntentCompat.getParcelableExtra(it, EXTRA_RESULT_RECEIVER, ResultReceiver::class.java)
        }
        return try {
            when (intent?.action) {
                ACTION_START_AUDIO -> startForegroundSession(includeProjection = false)
                ACTION_START_PROJECTION -> startForegroundSession(includeProjection = true)
                else -> throw IllegalArgumentException("Action de service Support invalide.")
            }
            resultReceiver?.send(Activity.RESULT_OK, Bundle())
            START_NOT_STICKY
        } catch (error: Exception) {
            resultReceiver?.send(
                Activity.RESULT_CANCELED,
                Bundle().apply { putString(EXTRA_ERROR, error.message ?: "Service audio indisponible.") }
            )
            stopSelf(startId)
            START_NOT_STICKY
        }
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
        private const val EXTRA_RESULT_RECEIVER = "cm.naxa.app.extra.FGS_RESULT_RECEIVER"
        private const val EXTRA_ERROR = "cm.naxa.app.extra.FGS_ERROR"

        private suspend fun startAndAwait(context: Context, action: String) = withTimeout(10_000) {
            suspendCancellableCoroutine<Unit> { continuation ->
                val receiver = object : ResultReceiver(Handler(Looper.getMainLooper())) {
                    override fun onReceiveResult(resultCode: Int, resultData: Bundle?) {
                        if (!continuation.isActive) return
                        if (resultCode == Activity.RESULT_OK) {
                            continuation.resume(Unit)
                        } else {
                            continuation.resumeWithException(
                                IOException(resultData?.getString(EXTRA_ERROR) ?: "Service audio indisponible.")
                            )
                        }
                    }
                }
                val intent = Intent(context, NaxaMediaProjectionService::class.java)
                    .setAction(action)
                    .putExtra(EXTRA_RESULT_RECEIVER, receiver)
                continuation.invokeOnCancellation {
                    // A timed-out/cancelled start must not leave a partially
                    // promoted microphone/projection service running.
                    context.stopService(intent)
                }
                try {
                    ContextCompat.startForegroundService(context, intent)
                } catch (error: Exception) {
                    if (continuation.isActive) continuation.resumeWithException(error)
                }
            }
        }

        suspend fun startAudio(context: Context) = startAndAwait(context, ACTION_START_AUDIO)

        /** Called only after createScreenCaptureIntent() returned RESULT_OK. */
        suspend fun startProjection(context: Context) = startAndAwait(context, ACTION_START_PROJECTION)

        /** Drop the projection type while keeping the microphone call alive. */
        suspend fun stopProjection(context: Context) = startAndAwait(context, ACTION_START_AUDIO)

        fun stop(context: Context) {
            context.stopService(Intent(context, NaxaMediaProjectionService::class.java))
        }
    }
}
