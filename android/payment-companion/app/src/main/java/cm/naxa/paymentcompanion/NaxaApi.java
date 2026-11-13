package cm.naxa.paymentcompanion;

import android.content.Context;

import org.json.JSONObject;

public final class NaxaApi {
    private NaxaApi() { }

    public static void enroll(Context context, String role) throws Exception {
        String base = SecureVault.get(context, "naxa_base_url");
        String access = SupabaseSession.getAccessToken(context);
        String installationId = getOrCreateInstallationId(context);
        String deviceName = android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL;
        if (base == null || !base.startsWith("https://")) {
            throw new IllegalStateException("URL HTTPS de NAXA manquante.");
        }

        if ("promoteur".equals(role)) {
            JSONObject body = new JSONObject()
                    .put("installationId", installationId)
                    .put("deviceName", deviceName);
            JSONObject response = HttpClient.post(
                    SupabaseSession.trimSlash(base) + "/api/promoteur/paiements/device/register",
                    access, null, body
            );
            SecureVault.put(context, "promoteur_device_id", response.getString("deviceId"));
            SecureVault.put(context, "promoteur_device_token", response.getString("deviceToken"));
            SecureVault.put(context, "companion_role", "promoteur");
            return;
        }

        if (!"admin".equals(role)) throw new IllegalArgumentException("Role non pris en charge.");
        for (String channel : new String[]{"orange_money", "mtn_momo"}) {
            JSONObject body = new JSONObject()
                    .put("installationId", installationId)
                    .put("deviceName", deviceName)
                    .put("canal", channel);
            JSONObject response = HttpClient.post(
                    SupabaseSession.trimSlash(base) + "/api/admin/paiements/device/register",
                    access, null, body
            );
            SecureVault.put(context, "admin_device_id_" + channel, response.getString("deviceId"));
            SecureVault.put(context, "admin_device_token_" + channel, response.getString("deviceToken"));
        }
        SecureVault.put(context, "companion_role", "admin");
    }

    private static String getOrCreateInstallationId(Context context) throws Exception {
        String id = SecureVault.get(context, "installation_id");
        if (id == null || id.length() < 36) {
            id = java.util.UUID.randomUUID().toString();
            SecureVault.put(context, "installation_id", id);
        }
        return id;
    }

    public static void sendCapturedSms(Context context, String channel, String sender,
                                       String message, long receivedAtMillis) throws Exception {
        String role = SecureVault.get(context, "companion_role");
        String base = SecureVault.get(context, "naxa_base_url");
        String access = SupabaseSession.getAccessToken(context);
        if (role == null || base == null || access == null) return;

        String path;
        String deviceId;
        String deviceToken;
        if ("promoteur".equals(role)) {
            path = "/api/promoteur/paiements/capture";
            deviceId = SecureVault.get(context, "promoteur_device_id");
            deviceToken = SecureVault.get(context, "promoteur_device_token");
        } else if ("admin".equals(role)) {
            path = "/api/admin/paiements/capture";
            deviceId = SecureVault.get(context, "admin_device_id_" + channel);
            deviceToken = SecureVault.get(context, "admin_device_token_" + channel);
        } else {
            return;
        }

        if (deviceId == null || deviceToken == null) return;
        JSONObject body = new JSONObject()
                .put("deviceId", deviceId)
                .put("deviceToken", deviceToken)
                .put("canal", channel)
                .put("smsText", message)
                .put("senderOriginAddress", sender)
                .put("smsReceivedAt", java.time.Instant.ofEpochMilli(receivedAtMillis).toString());

        JSONObject response = HttpClient.post(
                SupabaseSession.trimSlash(base) + path,
                access, null, body
        );
        String status = response.optString("status", "received");
        SecureVault.put(context, "last_capture_status", status);
        SecureVault.put(context, "last_capture_at", Long.toString(System.currentTimeMillis()));
    }
}
