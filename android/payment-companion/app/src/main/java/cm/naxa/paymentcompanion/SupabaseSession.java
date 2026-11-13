package cm.naxa.paymentcompanion;

import android.content.Context;

import org.json.JSONObject;

public final class SupabaseSession {
    private SupabaseSession() { }

    public static JSONObject login(Context context, String supabaseUrl, String anonKey,
                                   String email, String password) throws Exception {
        String base = trimSlash(supabaseUrl);
        JSONObject body = new JSONObject()
                .put("email", email.trim())
                .put("password", password);
        JSONObject response = HttpClient.post(
                base + "/auth/v1/token?grant_type=password",
                null,
                anonKey,
                body
        );
        saveSession(context, response);
        return response;
    }

    public static synchronized String getAccessToken(Context context) throws Exception {
        String access = SecureVault.get(context, "supabase_access_token");
        String expiresRaw = SecureVault.get(context, "supabase_expires_at");
        long expiresAt = 0L;
        try {
            expiresAt = Long.parseLong(expiresRaw == null ? "0" : expiresRaw);
        } catch (NumberFormatException ignored) { }

        if (access != null && expiresAt > System.currentTimeMillis() + 60_000L) {
            return access;
        }

        String refresh = SecureVault.get(context, "supabase_refresh_token");
        String supabaseUrl = SecureVault.get(context, "supabase_url");
        String anonKey = SecureVault.get(context, "supabase_anon_key");
        if (refresh == null || supabaseUrl == null || anonKey == null) {
            throw new IllegalStateException("Reconnectez le compte NAXA dans le compagnon.");
        }

        JSONObject body = new JSONObject().put("refresh_token", refresh);
        JSONObject response = HttpClient.post(
                trimSlash(supabaseUrl) + "/auth/v1/token?grant_type=refresh_token",
                null,
                anonKey,
                body
        );
        saveSession(context, response);
        String newAccess = SecureVault.get(context, "supabase_access_token");
        if (newAccess == null) throw new IllegalStateException("Jeton Supabase indisponible apres renouvellement.");
        return newAccess;
    }

    private static void saveSession(Context context, JSONObject response) throws Exception {
        String access = response.optString("access_token", "");
        String refresh = response.optString("refresh_token", "");
        long expiresIn = response.optLong("expires_in", 3600L);
        if (access.isEmpty() || refresh.isEmpty()) {
            throw new IllegalStateException("La reponse Supabase ne contient pas de session complete.");
        }
        SecureVault.put(context, "supabase_access_token", access);
        SecureVault.put(context, "supabase_refresh_token", refresh);
        SecureVault.put(context, "supabase_expires_at", Long.toString(System.currentTimeMillis() + expiresIn * 1000L));
        SecureVault.put(context, "supabase_user_id", response.optJSONObject("user") == null
                ? "" : response.optJSONObject("user").optString("id", ""));
    }

    public static String trimSlash(String value) {
        String out = value == null ? "" : value.trim();
        while (out.endsWith("/")) out = out.substring(0, out.length() - 1);
        return out;
    }
}
