package cm.naxa.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NaxaBleQueuePolicyTest {
    @Test
    fun acceptsEventsOnlyWhileSpaceRemains() {
        assertFalse(NaxaBleQueuePolicy.isAtCapacity(299))
        assertTrue(NaxaBleQueuePolicy.isAtCapacity(300))
        assertTrue(NaxaBleQueuePolicy.isAtCapacity(301))
    }

    @Test
    fun countsRejectedMeasurementsAndOtherEventsSeparately() {
        val first = NaxaBleQueuePolicy.recordDrop(null, incomingIsMeasurement = true)
        assertEquals(1, first.droppedCount)
        assertEquals(1, first.droppedMeasurementCount)

        val second = NaxaBleQueuePolicy.recordDrop(first, incomingIsMeasurement = false)
        assertEquals(2, second.droppedCount)
        assertEquals(1, second.droppedMeasurementCount)

        val third = NaxaBleQueuePolicy.recordDrop(second, incomingIsMeasurement = true)
        assertEquals(3, third.droppedCount)
        assertEquals(2, third.droppedMeasurementCount)
    }

    @Test
    fun preservesUnknownMeasurementBreakdownFromLegacyMarker() {
        val legacy = NaxaBleQueuePolicy.OverflowCounts(droppedCount = 4, droppedMeasurementCount = null)
        val next = NaxaBleQueuePolicy.recordDrop(legacy, incomingIsMeasurement = true)
        assertEquals(5, next.droppedCount)
        assertNull(next.droppedMeasurementCount)
    }
}
