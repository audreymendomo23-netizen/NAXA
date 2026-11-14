package cm.naxa.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Restores BLE sessions after a device reboot only after the saved NAXA account
 * has been revalidated against the server. Transient network failures keep the
 * encrypted session list but never start an unverified BLE connection.
 */
class NaxaBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return

        val owners = NaxaBleForegroundService.savedSessionOwners(context)
        if (owners.isEmpty()) return
        val bluetoothPermission = if (Build.VERSION.SDK_INT >= 31) {
            android.Manifest.permission.BLUETOOTH_CONNECT
        } else {
            android.Manifest.permission.ACCESS_FINE_LOCATION
        }
        if (context.checkSelfPermission(bluetoothPermission) != PackageManager.PERMISSION_GRANTED) return
        if (SecureTokenStore(context).read() == null) {
            NaxaBleForegroundService.stopForLogout(context)
            return
        }

        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val profile = AuthRepository(SecureTokenStore(context)).restoreSession()
                if (profile == null || !owners.contains(profile.userId)) {
                    NaxaBleForegroundService.stopForLogout(context)
                    return@launch
                }
                val serviceIntent = Intent(context, NaxaBleForegroundService::class.java)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                } catch (_: SecurityException) {
                    // Android permissions or background-start policy may prevent restoration.
                } catch (_: IllegalStateException) {
                    // The OS can deny a background service start; the app can resume on next open.
                }
            } catch (_: Exception) {
                // Network/API unavailability is not proof of revocation; keep sessions but do not reconnect.
            } finally {
                pending.finish()
            }
        }
    }
}
