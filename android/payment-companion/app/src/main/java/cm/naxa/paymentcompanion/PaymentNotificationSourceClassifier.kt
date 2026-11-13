package cm.naxa.paymentcompanion

/** Exact Android package IDs for the official MTN MoMo and Orange Money apps. */
object PaymentNotificationSourceClassifier {
    private val channels = mapOf(
        "mtnft.momo.consumer" to "mtn_momo",
        "com.orange.myorange.ocm" to "orange_money",
        "com.orange.money.cm.pro" to "orange_money",
        "com.orange.orangemoneyafrique" to "orange_money"
    )

    fun channelFromPackage(packageName: String?): String? =
        if (packageName.isNullOrBlank()) null else channels[packageName]
}
