package cm.naxa.paymentcompanion
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.telephony.SmsMessage
import java.util.Locale
import java.util.concurrent.Executors

class SmsReceiver : BroadcastReceiver() {
    companion object { private val EXECUTOR = Executors.newSingleThreadExecutor() }
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages: Array<SmsMessage> = try { Telephony.Sms.Intents.getMessagesFromIntent(intent) } catch (_: Exception) { return }
        if (messages.isEmpty()) return
        val rawOrigin = messages[0].originatingAddress
        val channel = channelFromRawOrigin(rawOrigin) ?: return
        val body = StringBuilder()
        for (part in messages) {
            if (channel != channelFromRawOrigin(part.originatingAddress)) return
            part.messageBody?.let(body::append)
        }
        val smsText = body.toString().trim()
        if (smsText.length < 12 || smsText.length > 8000) return
        val receivedAt = System.currentTimeMillis()
        val appContext = context.applicationContext
        val pending = goAsync()
        EXECUTOR.execute {
            try {
                NaxaApi.sendCapturedSms(appContext, channel, rawOrigin, smsText, receivedAt)
            } catch (error: Exception) {
                try {
                    SecureVault.put(appContext, "last_capture_status", "manual_review")
                    SecureVault.put(appContext, "last_capture_error", (error.message ?: "Transmission SMS impossible").take(180))
                } catch (_: Exception) { }
            } finally { pending.finish() }
        }
    }
    private fun channelFromRawOrigin(rawOrigin: String?): String? {
        if (rawOrigin == null) return null
        val normalized = rawOrigin.replace(Regex("[^A-Za-z0-9]"), "").uppercase(Locale.ROOT)
        if (normalized.matches(Regex("[0-9]+"))) return null
        return when (normalized) {
            "ORANGEMONEY" -> "orange_money"
            "MOBILEMONEY" -> "mtn_momo"
            else -> null
        }
    }
}
