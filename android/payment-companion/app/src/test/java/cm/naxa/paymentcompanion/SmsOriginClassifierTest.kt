package cm.naxa.paymentcompanion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SmsOriginClassifierTest {
    @Test
    fun acceptsOrangeMoneySender() {
        assertEquals("orange_money", SmsOriginClassifier.channelFromRawOrigin("OrangeMoney"))
    }

    @Test
    fun acceptsMtnMobileMoneySender() {
        assertEquals("mtn_momo", SmsOriginClassifier.channelFromRawOrigin("MobileMoney"))
    }

    @Test
    fun acceptsCaseAndFormattingVariantsOfAllowedSenderIds() {
        assertEquals("orange_money", SmsOriginClassifier.channelFromRawOrigin("ORANGE-MONEY"))
        assertEquals("mtn_momo", SmsOriginClassifier.channelFromRawOrigin("mobile money"))
    }

    @Test
    fun rejectsNumericSenderIds() {
        assertNull(SmsOriginClassifier.channelFromRawOrigin("237650123456"))
        assertNull(SmsOriginClassifier.channelFromRawOrigin("12345"))
    }

    @Test
    fun rejectsUnknownSenderIds() {
        assertNull(SmsOriginClassifier.channelFromRawOrigin("Orange"))
        assertNull(SmsOriginClassifier.channelFromRawOrigin("MTN"))
        assertNull(SmsOriginClassifier.channelFromRawOrigin("NAXA"))
    }

    @Test
    fun rejectsNullAndBlankSenders() {
        assertNull(SmsOriginClassifier.channelFromRawOrigin(null))
        assertNull(SmsOriginClassifier.channelFromRawOrigin(""))
        assertNull(SmsOriginClassifier.channelFromRawOrigin("   "))
    }
}
