package cm.naxa.paymentcompanion

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationCaptureGateTest {
    @Test fun clientIsNeverAllowedEvenWithConsent() {
        assertFalse(NotificationCaptureGate.canCapture("client", true, "OrangeMoney"))
        assertFalse(NotificationCaptureGate.canCapture("client", true, "MobileMoney"))
    }

    @Test fun promoterPartnerAndAdminRequireConsentAndExactSenderTitle() {
        listOf("promoteur", "partenaire", "admin").forEach { role ->
            assertTrue(NotificationCaptureGate.canCapture(role, true, "OrangeMoney"))
            assertTrue(NotificationCaptureGate.canCapture(role, true, "MobileMoney"))
            assertFalse(NotificationCaptureGate.canCapture(role, false, "OrangeMoney"))
            assertFalse(NotificationCaptureGate.canCapture(role, true, "orange money"))
            assertFalse(NotificationCaptureGate.canCapture(role, true, "MTN"))
        }
    }

    @Test fun exactTitlesMapToTheExpectedOperator() {
        assertTrue(NotificationCaptureGate.channelFromTitle("OrangeMoney") == "orange_money")
        assertTrue(NotificationCaptureGate.channelFromTitle("MobileMoney") == "mtn_momo")
        assertNull(NotificationCaptureGate.channelFromTitle("ORANGEMONEY"))
        assertNull(NotificationCaptureGate.channelFromTitle("MTN"))
        assertNull(NotificationCaptureGate.channelFromTitle(null))
    }
}
