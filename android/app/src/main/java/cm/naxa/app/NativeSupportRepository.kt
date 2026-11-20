package cm.naxa.app

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.IOException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class NativeSupportApiException(
    val statusCode: Int,
    val code: String,
    message: String
) : IOException(message)

data class NativeSupportTicket(
    val id: String,
    val reference: String,
    val subject: String,
    val category: String,
    val status: String
)

data class NativeSupportCall(
    val id: String,
    val ticketId: String,
    val status: String,
    val agentUserId: String?
)

data class NativeIceServer(
    val urls: List<String>,
    val username: String,
    val credential: String
)

class NativeSupportRepository(
    private val context: Context,
    private val authRepository: AuthRepository
) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS)
        .build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    suspend fun listTickets(userId: String): List<NativeSupportTicket> = withContext(Dispatchers.IO) {
        val query = contextBuildRestUrl(
            "tickets_support",
            mapOf(
                "select" to "id,reference_code,sujet,categorie,statut",
                "auteur_profile_id" to "eq.$userId",
                "type" to "eq.support_naxa",
                "order" to "last_activity_at.desc",
                "limit" to "30"
            )
        )
        val data = executeArray(request(query, "GET"))
        buildList {
            for (index in 0 until data.length()) {
                val row = data.optJSONObject(index) ?: continue
                add(
                    NativeSupportTicket(
                        id = row.optString("id"),
                        reference = row.optString("reference_code"),
                        subject = row.optString("sujet"),
                        category = row.optString("categorie"),
                        status = row.optString("statut")
                    )
                )
            }
        }
    }

    suspend fun createTicket(category: String, subject: String, message: String): NativeSupportTicket =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("p_categorie", category)
                .put("p_sujet", subject.trim())
                .put("p_message", message.trim())
            val url = BuildConfig.SUPABASE_URL.trimEnd('/') + "/rest/v1/rpc/open_naxa_support_ticket"
            val result = executeValue(request(url, "POST", body))
            val row = when (result) {
                is JSONArray -> result.optJSONObject(0)
                is JSONObject -> result
                else -> null
            } ?: throw IOException("La réponse d’ouverture du dossier Support est invalide.")
            NativeSupportTicket(
                id = row.optString("ticket_id"),
                reference = row.optString("reference_code"),
                subject = subject.trim(),
                category = category,
                status = "ouvert"
            )
        }

    suspend fun requestCall(ticketId: String): NativeSupportCall = withContext(Dispatchers.IO) {
        val data = executeObject(
            request(
                BuildConfig.NAXA_BASE_URL.trimEnd('/') + "/api/v1/support/calls",
                "POST",
                JSONObject().put("ticket_id", ticketId)
            )
        )
        data.optJSONObject("call")?.toCall()
            ?: throw IOException("Le serveur n’a pas retourné l’appel Support.")
    }

    suspend fun getCall(callId: String): NativeSupportCall = withContext(Dispatchers.IO) {
        val data = executeObject(
            request(BuildConfig.NAXA_BASE_URL.trimEnd('/') + "/api/v1/support/calls/" + callId, "GET")
        )
        data.optJSONObject("call")?.toCall()
            ?: throw IOException("L’état de l’appel Support est indisponible.")
    }

    suspend fun heartbeat(callId: String) = withContext(Dispatchers.IO) {
        executeValue(
            request(
                BuildConfig.NAXA_BASE_URL.trimEnd('/') + "/api/v1/support/calls/" + callId + "/heartbeat",
                "POST",
                JSONObject()
            )
        )
    }

    suspend fun transition(callId: String, action: String): NativeSupportCall = withContext(Dispatchers.IO) {
        require(action == "cancel" || action == "end") { "Transition Support non autorisée." }
        val data = executeObject(
            request(
                BuildConfig.NAXA_BASE_URL.trimEnd('/') + "/api/v1/support/calls/" + callId,
                "PATCH",
                JSONObject().put("action", action)
            )
        )
        data.optJSONObject("call")?.toCall()
            ?: throw IOException("La transition d’appel n’a pas été confirmée.")
    }

    suspend fun iceServers(callId: String): List<NativeIceServer> = withContext(Dispatchers.IO) {
        val data = executeObject(
            request(BuildConfig.NAXA_BASE_URL.trimEnd('/') + "/api/v1/support/calls/" + callId + "/ice", "GET")
        )
        val servers = data.optJSONArray("iceServers") ?: JSONArray()
        buildList {
            for (index in 0 until servers.length()) {
                val item = servers.optJSONObject(index) ?: continue
                val rawUrls = item.opt("urls")
                val urls = when (rawUrls) {
                    is JSONArray -> buildList {
                        for (urlIndex in 0 until rawUrls.length()) {
                            rawUrls.optString(urlIndex).takeIf { it.isNotBlank() }?.let(::add)
                        }
                    }
                    is String -> listOf(rawUrls)
                    else -> emptyList()
                }
                if (urls.isNotEmpty()) {
                    add(
                        NativeIceServer(
                            urls = urls,
                            username = item.optString("username"),
                            credential = item.optString("credential")
                        )
                    )
                }
            }
        }.also {
            if (it.none { server -> server.urls.any { url -> url.startsWith("turn:") || url.startsWith("turns:") } }) {
                throw IOException("Le relais TURN Support n’est pas disponible.")
            }
        }
    }

    suspend fun screenShareEvent(
        callId: String,
        sessionId: String,
        action: String,
        reason: String? = null
    ) = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("action", action)
            .put("share_session_id", sessionId)
        if (reason != null) body.put("reason", reason)
        executeValue(
            request(
                BuildConfig.NAXA_BASE_URL.trimEnd('/') + "/api/v1/support/calls/" + callId + "/screen-share",
                "POST",
                body
            )
        )
    }

    suspend fun accessToken(): String = authRepository.currentAccessToken()

    private suspend fun request(url: String, method: String, body: JSONObject? = null): Request {
        val token = authRepository.currentAccessToken()
        val builder = Request.Builder()
            .url(url)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Cache-Control", "no-store")
        when (method) {
            "GET" -> builder.get()
            "POST" -> builder.post((body ?: JSONObject()).toString().toRequestBody(jsonType))
            "PATCH" -> builder.patch((body ?: JSONObject()).toString().toRequestBody(jsonType))
            else -> throw IllegalArgumentException("Méthode HTTP native non autorisée.")
        }
        if (method != "GET") builder.header("Content-Type", "application/json")
        return builder.build()
    }

    private fun executeValue(request: Request): Any = http.newCall(request).execute().use { response ->
        val raw = response.body?.string().orEmpty()
        val parsed = try {
            if (raw.isBlank()) JSONObject() else JSONTokener(raw).nextValue()
        } catch (_: Exception) {
            JSONObject()
        }
        if (!response.isSuccessful) {
            val code = (parsed as? JSONObject)?.optString("code").orEmpty()
            val message = (parsed as? JSONObject)?.optString("message").orEmpty()
            throw NativeSupportApiException(
                statusCode = response.code,
                code = code,
                message = message.ifBlank { code.ifBlank { "Service Support indisponible (HTTP ${response.code})." } }
            )
        }
        parsed
    }

    private fun executeObject(request: Request): JSONObject =
        executeValue(request) as? JSONObject ?: throw IOException("La réponse du service Support est invalide.")

    private fun executeArray(request: Request): JSONArray =
        executeValue(request) as? JSONArray ?: throw IOException("La liste des dossiers Support est invalide.")

    private fun contextBuildRestUrl(table: String, query: Map<String, String>): String {
        val params = query.entries.joinToString("&") { (key, value) ->
            URLEncoder.encode(key, "UTF-8") + "=" + URLEncoder.encode(value, "UTF-8")
        }
        return BuildConfig.SUPABASE_URL.trimEnd('/') + "/rest/v1/" + table + "?" + params
    }

    private fun JSONObject.toCall() = NativeSupportCall(
        id = optString("id"),
        ticketId = optString("ticket_id"),
        status = optString("status"),
        agentUserId = optString("agent_user_id").takeIf { it.isNotBlank() && it != "null" }
    )
}
