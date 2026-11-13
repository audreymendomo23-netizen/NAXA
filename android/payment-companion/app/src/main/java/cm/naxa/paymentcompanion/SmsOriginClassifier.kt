package cm.naxa.paymentcompanion

import java.util.Locale

/**
 * Keeps the allowlist deliberately small: only the two operator sender IDs
 * used by the NAXA payment workflow are accepted.
 */
object SmsOriginClassifier {
    fun channelFromRawOrigin(rawOrigin: String?): String? {
        if (rawOrigin.isNullOrBlank()) return null
        val normalized = rawOrigin
            .replace(Regex("[^A-Za-z0-9]"), "")
            .uppercase(Locale.ROOT)

        if (normalized.matches(Regex("[0-9]+"))) return null

        return when (normalized) {
            "ORANGEMONEY" -> "orange_money"
            "MOBILEMONEY" -> "mtn_momo"
            else -> null
        }
    }
}
