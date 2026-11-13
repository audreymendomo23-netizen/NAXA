package cm.naxa.paymentcompanion

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsCaptureGateTest {
    @Test
    fun rejectsCaptureWithoutExplicitConsent() {
        assertFalse(SmsCaptureGate.canCapture(false, true, "orange_money"))
    }

    @Test
    fun rejectsCaptureWithoutAndroidPermission() {
        assertFalse(SmsCaptureGate.canCapture(true, false, "mtn_momo"))
    }

    @Test
    fun acceptsOnlyAllowlistedChannelsWhenBothPermissionsArePresent() {
        assertTrue(SmsCaptureGate.canCapture(true, true, "orange_money"))
        assertTrue(SmsCaptureGate.canCapture(true, true, "mtn_momo"))
    }

    @Test
    fun rejectsUnknownOrMissingChannels() {
        assertFalse(SmsCaptureGate.canCapture(true, true, "unknown"))
        assertFalse(SmsCaptureGate.canCapture(true, true, null))
    }

    @Test
    fun rejectsEveryChannelWhenConsentOrPermissionIsMissing() {
        listOf("orange_money", "mtn_momo", "unknown", null).forEach { channel ->
            assertFalse(SmsCaptureGate.canCapture(false, true, channel))
            assertFalse(SmsCaptureGate.canCapture(true, false, channel))
        }
    }
}
