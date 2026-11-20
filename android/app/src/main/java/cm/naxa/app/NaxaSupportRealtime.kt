package cm.naxa.app

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeout
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.io.Closeable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/**
 * Minimal Supabase Realtime v1.0.0 private-channel client for NAXA Support.
 * It intentionally transports only signalling metadata; media remains WebRTC.
 */
class NaxaSupportRealtime(
    private val supabaseUrl: String,
    private val anonKey: String,
    private val onSignal: (JSONObject) -> Unit,
    private val onStatus: (String) -> Unit
) : Closeable {
    private val http = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private val refs = AtomicLong(1)
    private val pending = ConcurrentHashMap<String, CompletableDeferred<Boolean>>()
    private val heartbeat = Executors.newSingleThreadScheduledExecutor()
    @Volatile private var socket: WebSocket? = null
    @Volatile private var topic = ""
    @Volatile private var joinRef = ""
    @Volatile private var connected = false
    @Volatile private var closed = false
    private var joinResult: CompletableDeferred<Unit>? = null

    suspend fun connect(callId: String, accessToken: String) {
        require(callId.matches(Regex("^[0-9a-fA-F-]{36}$"))) { "Identifiant d’appel invalide." }
        require(accessToken.isNotBlank()) { "Session NAXA absente." }
        topic = "realtime:naxa-support-call:$callId"
        joinRef = refs.getAndIncrement().toString()
        joinResult = CompletableDeferred()

        val base = supabaseUrl.trimEnd('/').toHttpUrl()
        val wsUrl = base.newBuilder()
            .scheme("wss")
            .encodedPath("/realtime/v1/websocket")
            .addQueryParameter("apikey", anonKey)
            .addQueryParameter("vsn", "1.0.0")
            .build()

        val request = Request.Builder().url(wsUrl).build()
        socket = http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                if (closed) return
                val payload = JSONObject()
                    .put("config", JSONObject()
                        .put("broadcast", JSONObject().put("ack", true).put("self", false))
                        .put("presence", JSONObject().put("enabled", false))
                        .put("private", true))
                    .put("access_token", accessToken)
                webSocket.send(envelope("phx_join", payload, joinRef, joinRef, topic).toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val message = try { JSONObject(text) } catch (_: Exception) { return }
                when (message.optString("event")) {
                    "phx_reply" -> {
                        val ref = message.optString("ref")
                        val payload = message.optJSONObject("payload") ?: JSONObject()
                        val responsePayload = payload.optJSONObject("response") ?: JSONObject()
                        val ok = payload.optString("status") == "ok"
                        if (ref == joinRef) {
                            if (ok) {
                                connected = true
                                onStatus("connected")
                                joinResult?.complete(Unit)
                                startHeartbeat()
                            } else {
                                joinResult?.completeExceptionally(
                                    IllegalStateException(responsePayload.optString("reason", "Canal privé refusé."))
                                )
                            }
                        }
                        pending.remove(ref)?.complete(ok)
                    }
                    "broadcast" -> {
                        val payload = message.optJSONObject("payload") ?: return
                        if (payload.optString("event") == "signal") {
                            payload.optJSONObject("payload")?.let(onSignal)
                        }
                    }
                    "phx_error", "phx_close" -> {
                        connected = false
                        onStatus("error")
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                connected = false
                joinResult?.completeExceptionally(t)
                pending.values.forEach { it.complete(false) }
                pending.clear()
                onStatus("error")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                connected = false
                onStatus("closed")
            }
        })

        withTimeout(12_000) { joinResult!!.await() }
    }

    suspend fun broadcastSignal(signal: JSONObject) {
        check(connected && !closed) { "Le canal privé de signalisation n’est pas connecté." }
        val ref = refs.getAndIncrement().toString()
        val response = CompletableDeferred<Boolean>()
        pending[ref] = response
        val payload = JSONObject()
            .put("type", "broadcast")
            .put("event", "signal")
            .put("payload", signal)
        val sent = socket?.send(envelope("broadcast", payload, ref, joinRef, topic).toString()) == true
        if (!sent) {
            pending.remove(ref)
            throw IllegalStateException("La signalisation privée n’a pas pu être envoyée.")
        }
        if (!withTimeout(7_000) { response.await() }) {
            throw IllegalStateException("La signalisation privée a été refusée.")
        }
    }

    fun updateAccessToken(accessToken: String) {
        if (!connected || closed || accessToken.isBlank()) return
        val ref = refs.getAndIncrement().toString()
        socket?.send(envelope(
            "access_token",
            JSONObject().put("access_token", accessToken),
            ref,
            joinRef,
            topic
        ).toString())
    }

    private fun startHeartbeat() {
        heartbeat.scheduleAtFixedRate({
            if (!connected || closed) return@scheduleAtFixedRate
            val ref = refs.getAndIncrement().toString()
            socket?.send(envelope("heartbeat", JSONObject(), ref, null, "phoenix").toString())
        }, 20, 20, TimeUnit.SECONDS)
    }

    private fun envelope(
        event: String,
        payload: JSONObject,
        ref: String,
        joinRef: String?,
        topic: String
    ) = JSONObject()
        .put("topic", topic)
        .put("event", event)
        .put("payload", payload)
        .put("ref", ref)
        .apply { if (joinRef != null) put("join_ref", joinRef) }

    override fun close() {
        if (closed) return
        closed = true
        connected = false
        heartbeat.shutdownNow()
        pending.values.forEach { it.complete(false) }
        pending.clear()
        val current = socket
        if (current != null) {
            val ref = refs.getAndIncrement().toString()
            current.send(envelope("phx_leave", JSONObject(), ref, joinRef, topic).toString())
            current.close(1000, "Support call closed")
        }
        socket = null
    }
}
