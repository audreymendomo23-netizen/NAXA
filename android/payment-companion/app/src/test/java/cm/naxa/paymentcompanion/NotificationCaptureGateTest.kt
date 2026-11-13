package cm.naxa.paymentcompanion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationCaptureGateTest {
    @Test fun mapsOnlyPublishedMobileMoneyAppPackages() {
        assertEquals("mtn_momo", NotificationCaptureGate.channelFromSourcePackage("mtnft.momo.consumer"))
        assertEquals("orange_money", NotificationCaptureGate.channelFromSourcePackage("com.orange.myorange.ocm"))
        assertEquals("orange_money", NotificationCaptureGate.channelFromSourcePackage("com.orange.money.cm.pro"))
        assertEquals("orange_money", NotificationCaptureGate.channelFromSourcePackage("com.orange.orangemoneyafrique"))
        assertNull(NotificationCaptureGate.channelFromSourcePackage("com.whatsapp"))
    }

    @Test fun onlyPharmacyPartnerAndAdminCanUseTheReader() {
        listOf("pharmacie", "partenaire", "admin").forEach { role ->
            assertTrue(NotificationCaptureGate.canCapture(role, true, "mtnft.momo.consumer"))
        }
        assertFalse(NotificationCaptureGate.canCapture("client", true, "mtnft.momo.consumer"))
        assertFalse(NotificationCaptureGate.canCapture("promoteur", true, "mtnft.momo.consumer"))
        assertFalse(NotificationCaptureGate.canCapture("partenaire", false, "mtnft.momo.consumer"))
        assertFalse(NotificationCaptureGate.canCapture("admin", true, "com.whatsapp"))
    }
}
