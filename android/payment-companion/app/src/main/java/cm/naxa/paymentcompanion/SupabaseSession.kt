package cm.naxa.paymentcompanion
import android.content.Context
import org.json.JSONObject

object SupabaseSession {
    fun login(context: Context, supabaseUrl: String, anonKey: String, email: String, password: String): JSONObject {
        val body = JSONObject().put("email", email.trim()).put("password", password)
        val response = HttpClient.post(trimSlash(supabaseUrl) + "/auth/v1/token?grant_type=password", null, anonKey, body)
        saveSession(context, response)
        return response
    }
    @Synchronized fun getAccessToken(context: Context): String {
        val access = SecureVault.get(context, "supabase_access_token")
        val expiresAt = SecureVault.get(context, "supabase_expires_at")?.toLongOrNull() ?: 0L
        if (access != null && expiresAt > System.currentTimeMillis() + 60_000L) return access
        val refresh = SecureVault.get(context, "supabase_refresh_token")
        val supabaseUrl = SecureVault.get(context, "supabase_url")
        val anonKey = SecureVault.get(context, "supabase_anon_key")
        if (refresh == null || supabaseUrl == null || anonKey == null) error("Reconnectez le compte NAXA dans le compagnon.")
        val response = HttpClient.post(trimSlash(supabaseUrl) + "/auth/v1/token?grant_type=refresh_token", null, anonKey,
            JSONObject().put("refresh_token", refresh))
        saveSession(context, response)
        return SecureVault.get(context, "supabase_access_token") ?: error("Jeton Supabase indisponible apres renouvellement.")
    }
    private fun saveSession(context: Context, response: JSONObject) {
        val access = response.optString("access_token", "")
        val refresh = response.optString("refresh_token", "")
        val expiresIn = response.optLong("expires_in", 3600L)
        require(access.isNotEmpty() && refresh.isNotEmpty()) { "La reponse Supabase ne contient pas de session complete." }
        SecureVault.put(context, "supabase_access_token", access)
        SecureVault.put(context, "supabase_refresh_token", refresh)
        SecureVault.put(context, "supabase_expires_at", (System.currentTimeMillis() + expiresIn * 1000L).toString())
        SecureVault.put(context, "supabase_user_id", response.optJSONObject("user")?.optString("id", "").orEmpty())
    }
    fun trimSlash(value: String?): String {
        var out = value?.trim().orEmpty()
        while (out.endsWith("/")) out = out.dropLast(1)
        return out
    }
}
