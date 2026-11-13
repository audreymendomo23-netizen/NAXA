package cm.naxa.paymentcompanion

/**
 * Exact provider sender allowlist. No case folding or punctuation normalization:
 * the received SMS origin must be exactly OrangeMoney or MobileMoney.
 */
object SmsOriginClassifier {
    fun channelFromRawOrigin(rawOrigin: String?): String? = when (rawOrigin?.trim()) {
        "OrangeMoney" -> "orange_money"
        "MobileMoney" -> "mtn_momo"
        else -> null
    }
}
