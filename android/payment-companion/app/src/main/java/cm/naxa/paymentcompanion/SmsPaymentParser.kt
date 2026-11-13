package cm.naxa.paymentcompanion

import java.text.Normalizer
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class PayerSmsData(
    val direction: String,
    val success: Boolean,
    val amount: Int?,
    val reference: String?,
    val occurredAt: String?,
    val payerNumber: String?,
    val merchantNumber: String?
)

/** Deterministic preview parser; the server independently parses the original shared text. */
object SmsPaymentParser {
    private val douala = ZoneId.of("Africa/Douala")

    fun parsePayer(raw: String, channel: String): PayerSmsData? {
        if (raw.length !in 12..8000) return null
        val text = normalize(raw)
        if (channel == "orange_money") {
            val payer = Regex("paiement de (.+?) reussi par ([0-9]{8,15})\\s+[^.]*[.]?\\s*id transaction:\\s*([a-z0-9.]+),\\s*montant:\\s*([0-9][0-9 .,]*)\\s*fcfa").find(text)
            if (payer != null) return PayerSmsData(
                "payer_debit", true, parseAmount(payer.groupValues[4]), payer.groupValues[3].uppercase(),
                null, normalizePhone(payer.groupValues[2]), null
            )
        }
        if (channel == "mtn_momo") {
            val payer = Regex("(?:votre paiement|your payment) de? ?([0-9][0-9 .,]*)\\s*(?:xaf|fcfa)\\s+(?:a|to)\\s+.+?\\(([0-9]{8,15})\\)\\s+(?:a ete finalise a|was (?:successfully )?completed at|was successful at)\\s+(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2})").find(text)
            if (payer != null) {
                val ref = Regex("(?:identifiant de transaction financiere|financial transaction id)\\s*:\\s*([a-z0-9-]+)").find(text)?.groupValues?.get(1)?.uppercase()
                return PayerSmsData(
                    "payer_debit", true, parseAmount(payer.groupValues[1]), ref,
                    parseProviderDate(payer.groupValues[3]), null, normalizePhone(payer.groupValues[2])
                )
            }
        }
        return null
    }

    fun nowInDouala(): String = java.time.OffsetDateTime.now(douala).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)

    fun toIsoDateTime(value: String): String {
        val raw = value.trim()
        return try { java.time.Instant.parse(raw).toString() }
        catch (_: Exception) {
            try { java.time.OffsetDateTime.parse(raw).toInstant().toString() }
            catch (_: Exception) {
                LocalDateTime.parse(raw.replace(' ', 'T')).atZone(douala).toInstant().toString()
            }
        }
    }

    private fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "")
        .replace('\u00a0', ' ')
        .lowercase()
        .replace(Regex("\\s+"), " ")
        .trim()

    private fun parseAmount(value: String?): Int? {
        if (value.isNullOrBlank()) return null
        val digits = value.replace(Regex("[^0-9]"), "")
        val amount = digits.toLongOrNull() ?: return null
        return if (amount in 1..Int.MAX_VALUE) amount.toInt() else null
    }

    private fun normalizePhone(value: String?): String? {
        if (value.isNullOrBlank()) return null
        val digits = value.replace(Regex("[^0-9]"), "")
        return digits.takeIf { it.length in 8..15 }
    }

    private fun parseProviderDate(value: String?): String? = try {
        if (value.isNullOrBlank()) null else LocalDateTime
            .parse(value, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
            .atZone(douala).toInstant().toString()
    } catch (_: Exception) { null }
}
