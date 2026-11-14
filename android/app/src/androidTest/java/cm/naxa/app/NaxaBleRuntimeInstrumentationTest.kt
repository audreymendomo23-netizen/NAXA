package cm.naxa.app

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.NetworkType
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

/**
 * Exercises the actual Android Keystore-backed queue and persisted WorkManager
 * scheduling on an API 35 emulator. It does not simulate a physical BLE peripheral.
 */
@RunWith(AndroidJUnit4::class)
class NaxaBleRuntimeInstrumentationTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext

    private val preferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Before
    fun clearNativeState() {
        WorkManager.getInstance(context)
            .cancelUniqueWork(UNIQUE_WORK_NAME)
            .result.get(10, TimeUnit.SECONDS)
        assertTrue(preferences.edit().clear().commit())
    }

    @After
    fun cleanupNativeState() {
        WorkManager.getInstance(context)
            .cancelUniqueWork(UNIQUE_WORK_NAME)
            .result.get(10, TimeUnit.SECONDS)
        assertTrue(preferences.edit().clear().commit())
    }

    @Test
    fun androidKeystoreQueueRefusesOverflowWithoutEvictingAndResumesAfterAck() {
        repeat(NaxaBleQueuePolicy.CAPACITY) { sequence ->
            val stored = NaxaBleForegroundService.enqueueEvent(
                context,
                JSONObject()
                    .put("type", "instrumentation_probe")
                    .put("sequence", sequence)
            )
            assertTrue("Événement $sequence doit être accepté", stored)
        }

        assertTrue(NaxaBleForegroundService.isQueueSaturated(context))
        val encryptedQueue = preferences.getString(QUEUE_KEY, null)
        assertNotNull(encryptedQueue)
        assertFalse(
            "La file persistée ne doit pas contenir le JSON en clair",
            encryptedQueue!!.trimStart().startsWith("[")
        )

        // 301e and 302e are refused; the 300 accepted events stay in their original order.
        assertFalse(enqueueProbe(NaxaBleQueuePolicy.CAPACITY))
        assertFalse(enqueueProbe(NaxaBleQueuePolicy.CAPACITY + 1))

        val fullSnapshot = JSONArray(NaxaBleForegroundService.pendingEvents(context))
        assertEquals(NaxaBleQueuePolicy.CAPACITY + 1, fullSnapshot.length())
        repeat(NaxaBleQueuePolicy.CAPACITY) { sequence ->
            assertEquals(sequence, fullSnapshot.getJSONObject(sequence).getInt("sequence"))
        }
        val overflow = fullSnapshot.getJSONObject(fullSnapshot.length() - 1)
        assertEquals("queueOverflow", overflow.getString("type"))
        assertEquals(2, overflow.getInt("droppedCount"))
        assertEquals(0, overflow.getInt("droppedMeasurementCount"))

        // A confirmed ACK frees one place. The overflow marker remains until it is ACKed.
        val firstAcceptedEventId = fullSnapshot.getJSONObject(0).getString("eventId")
        NaxaBleForegroundService.acknowledgeEvents(context, setOf(firstAcceptedEventId))
        assertFalse(NaxaBleForegroundService.isQueueSaturated(context))

        val releasedSnapshot = JSONArray(NaxaBleForegroundService.pendingEvents(context))
        assertEquals(NaxaBleQueuePolicy.CAPACITY, releasedSnapshot.length())
        val overflowAfterRelease = releasedSnapshot.getJSONObject(releasedSnapshot.length() - 1)
        assertEquals("queueOverflow", overflowAfterRelease.getString("type"))
        NaxaBleForegroundService.acknowledgeEvents(
            context,
            setOf(overflowAfterRelease.getString("eventId"))
        )

        assertTrue(enqueueProbe(NaxaBleQueuePolicy.CAPACITY + 2))
        val resumedSnapshot = JSONArray(NaxaBleForegroundService.pendingEvents(context))
        assertEquals(NaxaBleQueuePolicy.CAPACITY, resumedSnapshot.length())
        assertTrue((0 until resumedSnapshot.length()).all {
            resumedSnapshot.getJSONObject(it).optString("type") != "queueOverflow"
        })
    }

    @Test
    fun measurementSyncIsPersistedWithNetworkConstraint() {
        NaxaBleMeasurementSyncWorker.enqueue(context)

        val scheduled = WorkManager.getInstance(context)
            .getWorkInfosForUniqueWork(UNIQUE_WORK_NAME)
            .get(10, TimeUnit.SECONDS)
        assertTrue("Le travail unique de synchronisation doit être enregistré", scheduled.isNotEmpty())

        val work = scheduled.last()
        assertEquals(
            "cm.naxa.app.NaxaBleMeasurementSyncWorker",
            work.workerClassName
        )
        assertEquals(NetworkType.CONNECTED, work.constraints.requiredNetworkType)
    }

    private fun enqueueProbe(sequence: Int): Boolean = NaxaBleForegroundService.enqueueEvent(
        context,
        JSONObject()
            .put("type", "instrumentation_probe")
            .put("sequence", sequence)
    )

    private companion object {
        const val PREFERENCES_NAME = "naxa_ble_background"
        const val QUEUE_KEY = "pending_events"
        const val UNIQUE_WORK_NAME = "naxa-native-ble-measurement-sync"
    }
}
