package cm.naxa.paymentcompanion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SmsPaymentParserTest {
    @Test fun parsesOrangePayerSmsAndAmountReferencePhone() {
        val sms = "Paiement de NAXA reussi par 237690001122 sur le compte marchand. ID transaction: ABC123456, montant: 5 000 FCFA"
        val result = SmsPaymentParser.parsePayer(sms, "orange_money")
        assertEquals("payer_debit", result?.direction)
        assertEquals(5000, result?.amount)
        assertEquals("ABC123456", result?.reference)
        assertEquals("237690001122", result?.payerNumber)
        assertNull(result?.occurredAt)
    }

    @Test fun parsesMtnPayerSmsAndProviderDate() {
        val sms = "Votre paiement de 5000 XAF a NAXA (237650123456) a ete finalise a 2026-11-13 15:12:10. Identifiant de transaction financiere: MTN123456"
        val result = SmsPaymentParser.parsePayer(sms, "mtn_momo")
        assertEquals("payer_debit", result?.direction)
        assertEquals(5000, result?.amount)
        assertEquals("MTN123456", result?.reference)
        assertEquals("237650123456", result?.merchantNumber)
        assertEquals("2026-11-13T14:12:10Z", result?.occurredAt)
    }

    @Test fun rejectsUnrecognizedOrWrongChannelMessages() {
        assertNull(SmsPaymentParser.parsePayer("Bonjour, votre compte a ete consulte.", "orange_money"))
        assertNull(SmsPaymentParser.parsePayer("Paiement de NAXA reussi par 237690001122 ID transaction: ABC123456, montant: 5 000 FCFA", "mtn_momo"))
    }

    @Test fun parsesManualLocalDateUsingCameroonOffset() {
        assertEquals("2026-11-13T14:00:00Z", SmsPaymentParser.toIsoDateTime("2026-11-13 15:00"))
    }
}
