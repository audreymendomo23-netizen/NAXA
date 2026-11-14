package cm.naxa.app

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import java.util.concurrent.TimeUnit

/**
 * Durable network-constrained consumer for the encrypted native BLE event queue.
 * It does not own a Bluetooth connection; NaxaBleForegroundService remains the only BLE owner.
 */
class NaxaBleMeasurementSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = queueMutex.withLock {
        try {
            drainPendingMeasurements()
            Result.success()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // No ACK was written for the failed event; WorkManager retries after network/backoff.
            Result.retry()
        }
    }

    private suspend fun drainPendingMeasurements() {
        val context = applicationContext
        val allEvents = JSONArray(NaxaBleForegroundService.pendingEvents(context))
        val measurementEvents = (0 until allEvents.length()).mapNotNull { index ->
            allEvents.optJSONObject(index)?.takeIf { it.optString("type") == "measurement" }
        }
        if (measurementEvents.isEmpty()) return

        val tokens = SecureTokenStore(context)
        val profile = AuthRepository(tokens).restoreSession() ?: return
        val ownerId = profile.userId
        val repository = SuiviBluetoothRepository(tokens)
        val consentFamilies = repository.loadGrantedFamilies(ownerId)
        val deviceIds = mutableMapOf<String, String>()

        for (event in measurementEvents) {
            if (isStopped) throw CancellationException("Travail de synchronisation interrompu.")
            val eventId = event.optString("eventId")
            val eventOwner = event.optString("ownerUserId")
            // Never reassign an offline measurement to whichever account is currently signed in.
            if (eventOwner != ownerId || eventId.isBlank()) continue

            val deviceKey = event.optString("deviceKey")
            val deviceFamily = SuiviMeasurementFamilies.device(deviceKey)
            if (deviceFamily == null || deviceFamily !in consentFamilies) {
                // The authenticated owner's current consent was fetched successfully; revoked
                // or unsupported-family events are discarded rather than uploaded.
                NaxaBleForegroundService.acknowledgeEvents(context, setOf(eventId))
                continue
            }

            val deviceAddress = event.optString("deviceId")
            val deviceName = event.optString("deviceName", "Appareil Bluetooth")
            val serviceUuid = event.optString("serviceUuid")
            val characteristicUuid = event.optString("characteristicUuid")
            val deviceCacheKey = "$ownerId:$deviceAddress:$deviceKey"
            val decoded = try {
                NaxaGattMeasurementDecoder.decode(
                    serviceUuid,
                    characteristicUuid,
                    event.optString("payloadHex"),
                    deviceAddress
                )
            } catch (_: UnsupportedOperationException) {
                NaxaBleForegroundService.acknowledgeEvents(context, setOf(eventId))
                continue
            } catch (_: IllegalArgumentException) {
                NaxaBleForegroundService.acknowledgeEvents(context, setOf(eventId))
                continue
            }

            val allowed = decoded.filter { measurement ->
                SuiviMeasurementFamilies.measurement(measurement.measurementType) in consentFamilies
            }
            if (allowed.isEmpty()) {
                // No DB-approved, consented measurement exists for this frame.
                NaxaBleForegroundService.acknowledgeEvents(context, setOf(eventId))
                continue
            }

            val deviceRowId = deviceIds[deviceCacheKey] ?: repository.ensureNativeDevice(
                ownerId,
                deviceKey,
                deviceName,
                deviceAddress,
                serviceUuid,
                characteristicUuid
            ).also { deviceIds[deviceCacheKey] = it }

            // persistNativeMeasurements validates all duplicate keys after HTTP 409.
            // If persistence or verification fails, this event remains in the encrypted queue.
            repository.persistNativeMeasurements(ownerId, deviceRowId, eventId, deviceName, allowed)
            NaxaBleForegroundService.acknowledgeEvents(context, setOf(eventId))
        }
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "naxa-native-ble-measurement-sync"
        private val queueMutex = Mutex()

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = OneTimeWorkRequestBuilder<NaxaBleMeasurementSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                UNIQUE_WORK_NAME,
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                request
            )
        }
    }
}
