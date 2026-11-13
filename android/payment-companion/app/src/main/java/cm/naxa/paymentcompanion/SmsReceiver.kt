package cm.naxa.paymentcompanion

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Telephony
import android.telephony.SmsMessage
import java.util.concurrent.Executors

class SmsReceiver : BroadcastReceiver() {
    companion object { private val EXECUTOR = Executors.newSingleThreadExecutor() }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val appContext = context.applicationContext
        val hasExplicitConsent = SecureVault.get(appContext, "sms_consent_granted") == "true"
        if (!hasExplicitConsent) return

        val hasAndroidPermission =
            appContext.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        if (!hasAndroidPermission) return

        val role = SecureVault.get(appContext, "companion_role")
        if (role != "promoteur" && role != "admin") return

        // Consent and Android permission are checked before extracting SMS data.
        val messages: Array<SmsMessage> = try {
            Telephony.Sms.Intents.getMessagesFromIntent(intent)
        } catch (_: Exception) {
            return
        }
        if (messages.isEmpty()) return

        val rawOrigin = messages[0].originatingAddress
        val channel = SmsOriginClassifier.channelFromRawOrigin(rawOrigin)
        if (!SmsCaptureGate.canCapture(hasExplicitConsent, hasAndroidPermission, channel)) return

        val body = StringBuilder()
        for (part in messages) {
            if (channel != SmsOriginClassifier.channelFromRawOrigin(part.originatingAddress)) return
            part.messageBody?.let(body::append)
        }
        val smsText = body.toString().trim()
        if (smsText.length < 12 || smsText.length > 8000) return

        val receivedAt = System.currentTimeMillis()
        val pending = goAsync()
        EXECUTOR.execute {
            try {
                NaxaApi.sendCapturedSms(appContext, channel!!, rawOrigin, smsText, receivedAt)
            } catch (error: Exception) {
                try {
                    SecureVault.put(appContext, "last_capture_status", "manual_review")
                    SecureVault.put(appContext, "last_capture_error", (error.message ?: "Transmission SMS impossible").take(180))
                } catch (_: Exception) { }
            } finally {
                pending.finish()
            }
        }
    }
}
