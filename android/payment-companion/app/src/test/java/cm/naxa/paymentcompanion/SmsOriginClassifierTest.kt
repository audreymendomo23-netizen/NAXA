package cm.naxa.paymentcompanion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SmsOriginClassifierTest {
    @Test fun acceptsOnlyExactOrangeSenderId() {
        assertEquals("orange_money", SmsOriginClassifier.channelFromRawOrigin("OrangeMoney"))
        assertNull(SmsOriginClassifier.channelFromRawOrigin("ORANGEMONEY"))
        assertNull(SmsOriginClassifier.channelFromRawOrigin("Orange-Money"))
    }

    @Test fun acceptsOnlyExactMtnSenderId() {
        assertEquals("mtn_momo", SmsOriginClassifier.channelFromRawOrigin("MobileMoney"))
        assertNull(SmsOriginClassifier.channelFromRawOrigin("MOBILEMONEY"))
        assertNull(SmsOriginClassifier.channelFromRawOrigin("Mobile Money"))
    }

    @Test fun rejectsNumericAndUnknownSenderIds() {
        listOf("237650123456", "12345", "Orange", "MTN", "NAXA", "", "   ", null).forEach {
            assertNull(SmsOriginClassifier.channelFromRawOrigin(it))
        }
    }
}
