package cm.naxa.paymentcompanion

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsCaptureGateTest {
    @Test fun rejectsClientAndPromoterRolesEvenWithPermissions() {
        listOf("client", "promoteur", null).forEach { role ->
            assertFalse(SmsCaptureGate.canCapture(role, true, true, "orange_money"))
            assertFalse(SmsCaptureGate.canCapture(role, true, true, "mtn_momo"))
        }
    }

    @Test fun acceptsPharmacyAndPartnerOnlyWithConsentAndPermission() {
        listOf("pharmacie", "partenaire").forEach { role ->
            assertTrue(SmsCaptureGate.canCapture(role, true, true, "orange_money"))
            assertTrue(SmsCaptureGate.canCapture(role, true, true, "mtn_momo"))
            assertFalse(SmsCaptureGate.canCapture(role, false, true, "orange_money"))
            assertFalse(SmsCaptureGate.canCapture(role, true, false, "mtn_momo"))
        }
    }

    @Test fun rejectsAdminWithoutExplicitConsent() {
        assertFalse(SmsCaptureGate.canCapture("admin", false, true, "orange_money"))
    }

    @Test fun rejectsAdminWithoutAndroidPermission() {
        assertFalse(SmsCaptureGate.canCapture("admin", true, false, "mtn_momo"))
    }

    @Test fun acceptsOnlyAllowlistedChannelsForAdmin() {
        assertTrue(SmsCaptureGate.canCapture("admin", true, true, "orange_money"))
        assertTrue(SmsCaptureGate.canCapture("admin", true, true, "mtn_momo"))
        assertFalse(SmsCaptureGate.canCapture("admin", true, true, "unknown"))
        assertFalse(SmsCaptureGate.canCapture("admin", true, true, null))
    }

    @Test fun rejectsEveryChannelWhenConsentOrPermissionIsMissing() {
        listOf("orange_money", "mtn_momo", "unknown", null).forEach { channel ->
            assertFalse(SmsCaptureGate.canCapture("admin", false, true, channel))
            assertFalse(SmsCaptureGate.canCapture("admin", true, false, channel))
        }
    }
}
