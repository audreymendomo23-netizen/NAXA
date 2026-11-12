package cm.naxa.paymentcompanion;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class SmsReceiver extends BroadcastReceiver {
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SmsMessage[] messages;
        try {
            messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        } catch (Exception error) {
            return;
        }
        if (messages == null || messages.length == 0) return;

        String rawOrigin = messages[0].getOriginatingAddress();
        String channel = channelFromRawOrigin(rawOrigin);
        if (channel == null) return;

        StringBuilder body = new StringBuilder();
        for (SmsMessage part : messages) {
            String partOrigin = part.getOriginatingAddress();
            if (!channel.equals(channelFromRawOrigin(partOrigin))) return;
            if (part.getMessageBody() != null) body.append(part.getMessageBody());
        }
        String smsText = body.toString().trim();
        if (smsText.length() < 12 || smsText.length() > 8000) return;

        long receivedAt = System.currentTimeMillis();
        Context appContext = context.getApplicationContext();
        PendingResult pending = goAsync();
        EXECUTOR.execute(() -> {
            try {
                NaxaApi.sendCapturedSms(appContext, channel, rawOrigin, smsText, receivedAt);
            } catch (Exception error) {
                try {
                    SecureVault.put(appContext, "last_capture_status", "manual_review");
                    SecureVault.put(appContext, "last_capture_error", error.getMessage() == null
                            ? "Transmission SMS impossible" : error.getMessage().substring(0, Math.min(180, error.getMessage().length())));
                } catch (Exception ignored) { }
            } finally {
                pending.finish();
            }
        });
    }

    private static String channelFromRawOrigin(String rawOrigin) {
        if (rawOrigin == null) return null;
        String normalized = rawOrigin.replaceAll("[^A-Za-z0-9]", "").toUpperCase(java.util.Locale.ROOT);
        if (normalized.matches("[0-9]+")) return null;
        if ("ORANGEMONEY".equals(normalized)) return "orange_money";
        if ("MOBILEMONEY".equals(normalized)) return "mtn_momo";
        return null;
    }
}
