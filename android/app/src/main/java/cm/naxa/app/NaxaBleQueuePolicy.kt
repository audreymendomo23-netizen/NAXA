package cm.naxa.app

/** Pure queue admission and overflow accounting, shared by the Android service and JVM tests. */
object NaxaBleQueuePolicy {
    const val CAPACITY = 300

    data class OverflowCounts(
        val droppedCount: Int,
        val droppedMeasurementCount: Int?
    )

    fun isAtCapacity(queueSize: Int): Boolean = queueSize >= CAPACITY

    fun recordDrop(previous: OverflowCounts?, incomingIsMeasurement: Boolean): OverflowCounts {
        val measurements = if (previous == null) {
            if (incomingIsMeasurement) 1 else 0
        } else {
            previous.droppedMeasurementCount?.let { count ->
                count + if (incomingIsMeasurement) 1 else 0
            }
        }
        return OverflowCounts(
            droppedCount = (previous?.droppedCount ?: 0) + 1,
            droppedMeasurementCount = measurements
        )
    }
}
