package cm.naxa.app

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.SystemClock
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.UUID

private val SupportGreen = Color(0xFF087A55)
private val SupportInk = Color(0xFF17342B)
private val SupportBackground = Color(0xFFF3F7F4)
private val TerminalCallStates = setOf("completed", "cancelled", "declined", "failed", "missed")

@Composable
internal fun NativeSupportScreen(
    profile: NaxaProfile,
    authRepository: AuthRepository,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val repository = remember(context, authRepository) { NativeSupportRepository(context, authRepository) }

    var tickets by remember { mutableStateOf<List<NativeSupportTicket>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var creating by remember { mutableStateOf(false) }
    var openingTicket by remember { mutableStateOf(false) }
    var ticketError by remember { mutableStateOf<String?>(null) }
    var callError by remember { mutableStateOf<String?>(null) }
    var newTicketVisible by remember { mutableStateOf(false) }
    var subject by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var currentCall by remember { mutableStateOf<NativeSupportCall?>(null) }
    var lastCallMessage by remember { mutableStateOf<String?>(null) }
    var rtcState by remember { mutableStateOf<NativeSupportRtcClient?>(null) }
    var realtimeState by remember { mutableStateOf<NaxaSupportRealtime?>(null) }
    var rtcStatus by remember { mutableStateOf("idle") }
    var attemptedRtcCallId by remember { mutableStateOf<String?>(null) }
    var rtcRetryNonce by remember { mutableIntStateOf(0) }
    var screenShareConsent by remember { mutableStateOf(false) }
    var screenShareActive by remember { mutableStateOf(false) }
    var pendingShareSessionId by remember { mutableStateOf<String?>(null) }
    var shareBusy by remember { mutableStateOf(false) }
    var pendingMicrophoneTicketId by remember { mutableStateOf<String?>(null) }

    fun closeMediaSession() {
        realtimeState?.close()
        realtimeState = null
        rtcState?.close()
        rtcState = null
        screenShareActive = false
        screenShareConsent = false
        rtcStatus = "idle"
    }

    suspend fun startCall(ticketId: String) {
        openingTicket = true
        callError = null
        try {
            val call = repository.requestCall(ticketId)
            currentCall = call
            lastCallMessage = null
            attemptedRtcCallId = null
            rtcStatus = "connecting"
        } catch (error: Exception) {
            callError = error.message ?: "La demande d’appel audio n’a pas été créée."
        } finally {
            openingTicket = false
        }
    }

    val microphonePermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val ticketId = pendingMicrophoneTicketId
        pendingMicrophoneTicketId = null
        if (granted && ticketId != null) {
            scope.launch { startCall(ticketId) }
        } else if (!granted) {
            callError = "L’accès au microphone est nécessaire pour démarrer l’assistance audio."
        }
    }

    fun requestCall(ticketId: String) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED
        ) {
            scope.launch { startCall(ticketId) }
        } else {
            pendingMicrophoneTicketId = ticketId
            microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    val mediaProjectionPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callId = currentCall?.id
        val sessionId = pendingShareSessionId
        pendingShareSessionId = null
        if (callId == null || sessionId == null) return@rememberLauncherForActivityResult

        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            scope.launch {
                shareBusy = true
                callError = null
                try {
                    val rtc = rtcState ?: throw IllegalStateException("La connexion audio n’est pas prête.")
                    rtc.startScreenShare(result.data!!, sessionId)
                    screenShareActive = true
                } catch (error: Exception) {
                    callError = error.message ?: "Le partage d’écran n’a pas pu démarrer."
                    screenShareConsent = false
                } finally {
                    shareBusy = false
                }
            }
        } else {
            scope.launch {
                runCatching {
                    repository.screenShareEvent(callId, sessionId, "denied", "user_cancelled")
                }.onFailure { callError = it.message ?: "Le refus du sélecteur n’a pas pu être journalisé." }
                screenShareConsent = false
            }
        }
    }

    fun requestScreenShare() {
        val call = currentCall
        if (!screenShareConsent) {
            callError = "Cochez d’abord votre consentement explicite au partage d’écran."
            return
        }
        if (call?.status != "accepted" || rtcState == null || rtcStatus != "connected") {
            callError = "L’appel audio doit être connecté avant le partage d’écran."
            return
        }
        if (shareBusy || screenShareActive || pendingShareSessionId != null) return
        val manager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        pendingShareSessionId = UUID.randomUUID().toString()
        mediaProjectionPermission.launch(manager.createScreenCaptureIntent())
    }

    fun stopScreenShare() {
        val rtc = rtcState ?: return
        scope.launch {
            shareBusy = true
            try {
                rtc.stopScreenShare("user_stopped", audit = true)
                screenShareActive = false
                screenShareConsent = false
            } catch (error: Exception) {
                callError = error.message ?: "L’arrêt du partage d’écran n’a pas été confirmé."
            } finally {
                shareBusy = false
            }
        }
    }

    fun finishCall() {
        val call = currentCall ?: return
        scope.launch {
            openingTicket = true
            try {
                val action = if (call.status == "accepted") "end" else "cancel"
                currentCall = repository.transition(call.id, action)
                // The server trigger records call_ended when an active share is
                // open. Do not write a competing manual stop event here.
                rtcState?.close()
                realtimeState?.close()
                rtcState = null
                realtimeState = null
                screenShareActive = false
                screenShareConsent = false
                rtcStatus = "idle"
            } catch (error: Exception) {
                callError = error.message ?: "La clôture de l’appel n’a pas été confirmée."
            } finally {
                openingTicket = false
            }
        }
    }

    BackHandler(enabled = true) {
        val active = currentCall
        if (active != null && active.status !in TerminalCallStates) finishCall()
        else {
            closeMediaSession()
            onBack()
        }
    }

    LaunchedEffect(profile.userId) {
        loading = true
        ticketError = null
        try {
            tickets = repository.listTickets(profile.userId)
        } catch (error: Exception) {
            ticketError = error.message ?: "Impossible de charger les dossiers Support."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(currentCall?.id, rtcRetryNonce) {
        val callId = currentCall?.id ?: return@LaunchedEffect
        if (currentCall?.status?.let { it in TerminalCallStates } == true) return@LaunchedEffect

        try {
            kotlinx.coroutines.coroutineScope {
                val heartbeatJob = launch {
                    while (isActive) {
                        try {
                            repository.heartbeat(callId)
                            realtimeState?.updateAccessToken(repository.accessToken())
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (error: Exception) {
                            callError = error.message ?: "Le maintien de l’appel a échoué."
                            if (error is NativeSupportApiException && error.statusCode in setOf(401, 403)) {
                                closeMediaSession()
                                lastCallMessage = "La session d’assistance a été fermée après révocation ou suspension du compte."
                                currentCall = null
                                break
                            }
                        }
                        delay(15_000)
                    }
                }
                try {
                    while (isActive) {
                        try {
                            val latest = repository.getCall(callId)
                            currentCall = latest

                            if (latest.status == "accepted" && attemptedRtcCallId != callId) {
                            attemptedRtcCallId = callId
                            try {
                                val iceServers = repository.iceServers(callId)
                                lateinit var rtc: NativeSupportRtcClient
                                rtc = NativeSupportRtcClient(context, repository) { status ->
                                    scope.launch(Dispatchers.Main) {
                                        rtcStatus = status
                                        if (status == "screen_stopped") {
                                            screenShareActive = false
                                            screenShareConsent = false
                                        }
                                    }
                                }
                                val realtime = NaxaSupportRealtime(
                                    supabaseUrl = BuildConfig.SUPABASE_URL,
                                    anonKey = BuildConfig.SUPABASE_ANON_KEY,
                                    onSignal = { signal -> rtc.handleSignal(signal) },
                                    onStatus = { status ->
                                        scope.launch(Dispatchers.Main) {
                                            if (status != "connected") rtcStatus = status
                                        }
                                    }
                                )
                                rtcState = rtc
                                realtimeState = realtime
                                rtc.prepare(callId, iceServers, realtime)
                                realtime.connect(callId, repository.accessToken())
                                realtime.broadcastSignal(JSONObject().put("kind", "ready"))
                                rtcStatus = "connecting"
                            } catch (error: Exception) {
                                closeMediaSession()
                                attemptedRtcCallId = callId
                                callError = error.message ?: "La connexion audio sécurisée n’a pas abouti."
                            }
                        }

                            if (latest.status in TerminalCallStates) {
                                lastCallMessage = supportCallStatus(latest.status)
                                closeMediaSession()
                                currentCall = null
                                break
                            }
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (error: Exception) {
                            callError = error.message ?: "Le suivi de l’appel est momentanément indisponible."
                            if (error is NativeSupportApiException && error.statusCode in setOf(401, 403)) {
                                closeMediaSession()
                                lastCallMessage = "La session d’assistance a été fermée après révocation ou suspension du compte."
                                currentCall = null
                                break
                            }
                            // Keep the independent requester heartbeat alive during
                            // transient API/network failures. The call reaper remains
                            // the server-side final safety net if the device is offline.
                        }
                        delay(2_500)
                    }
                } finally {
                    heartbeatJob.cancel()
                }
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            callError = error.message ?: "Le suivi de l’appel est interrompu."
            if (error is NativeSupportApiException && error.statusCode in setOf(401, 403)) {
                closeMediaSession()
                lastCallMessage = "La session d’assistance a été fermée après révocation ou suspension du compte."
                currentCall = null
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            realtimeState?.close()
            rtcState?.close()
        }
    }

    Surface(Modifier.fillMaxSize(), color = SupportBackground) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(Modifier.weight(1f)) {
                    Text("NAXA  /  ASSISTANCE", color = SupportGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text("Assistance NAXA", color = SupportInk, fontSize = 25.sp, fontWeight = FontWeight.ExtraBold)
                    Text("Profil : ${profile.effectiveRole}", color = SupportInk.copy(alpha = .65f), fontSize = 12.sp)
                }
                OutlinedButton(onClick = {
                    val active = currentCall
                    if (active != null && active.status !in TerminalCallStates) finishCall()
                    else { closeMediaSession(); onBack() }
                }) { Text("Retour") }
            }

            Text(
                "Décrivez votre demande à l’équipe NAXA. L’appel audio est proposé lorsqu’un Agent prend le dossier ; le partage d’écran reste facultatif.",
                color = SupportInk.copy(alpha = .75f),
                fontSize = 13.sp
            )

            if (ticketError != null) {
                SupportErrorCard(ticketError!!)
            }
            if (callError != null) {
                SupportErrorCard(callError!!)
            }

            lastCallMessage?.let { SupportInfoCard("Dernier appel", it) }

            currentCall?.let { call ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        Modifier.fillMaxWidth().padding(15.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Appel Support", color = SupportGreen, fontWeight = FontWeight.Bold)
                        Text(supportCallStatus(call.status), color = SupportInk, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        if (call.status == "accepted") {
                            Text(
                                when (rtcStatus) {
                                    "connected" -> "Audio connecté via le canal sécurisé."
                                    "connecting" -> "Connexion audio sécurisée en cours…"
                                    "screen_sharing" -> "Votre écran est partagé avec l’Agent."
                                    "reconnecting" -> "Reconnexion audio en cours."
                                    "screen_stopped" -> "Le partage d’écran a été arrêté."
                                    else -> "L’appel est accepté ; préparation du canal audio."
                                },
                                color = SupportInk.copy(alpha = .72f),
                                fontSize = 12.sp
                            )
                            if (rtcState == null || rtcStatus in setOf("disconnected", "reconnecting", "error")) {
                                OutlinedButton(
                                    onClick = {
                                        closeMediaSession()
                                        attemptedRtcCallId = null
                                        rtcRetryNonce += 1
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                ) { Text("Réessayer la connexion audio") }
                            }
                            if (screenShareActive) {
                                Button(
                                    onClick = ::stopScreenShare,
                                    enabled = !shareBusy,
                                    modifier = Modifier.fillMaxWidth()
                                ) { Text(if (shareBusy) "Arrêt…" else "Arrêter le partage d’écran") }
                            } else {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Checkbox(
                                        checked = screenShareConsent,
                                        onCheckedChange = { screenShareConsent = it },
                                        enabled = !shareBusy
                                    )
                                    Text(
                                        "J’accepte de partager mon écran avec l’Agent NAXA. Seule la capture système que je confirme sera transmise. Aucun enregistrement ni contrôle à distance.",
                                        color = SupportInk,
                                        fontSize = 11.sp
                                    )
                                }
                                Button(
                                    onClick = ::requestScreenShare,
                                    enabled = screenShareConsent && rtcStatus == "connected" && !shareBusy,
                                    modifier = Modifier.fillMaxWidth()
                                ) { Text(if (shareBusy) "Ouverture du sélecteur…" else "Partager mon écran") }
                            }
                        }
                        if (call.status !in TerminalCallStates) {
                            OutlinedButton(
                                onClick = ::finishCall,
                                enabled = !openingTicket,
                                modifier = Modifier.fillMaxWidth()
                            ) { Text(if (call.status == "accepted") "Raccrocher" else "Annuler la demande") }
                        }
                    }
                }
            }

            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Mes dossiers", color = SupportInk, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                OutlinedButton(onClick = { newTicketVisible = true }, enabled = !creating && currentCall == null) {
                    Text("Nouveau dossier")
                }
            }

            if (loading && tickets.isEmpty()) {
                CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally), color = SupportGreen)
            } else if (tickets.isEmpty() && ticketError == null) {
                SupportInfoCard("Aucun dossier", "Vous n’avez pas encore envoyé de demande d’assistance.")
            }

            tickets.forEach { ticket ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(15.dp)
                ) {
                    Column(
                        Modifier.fillMaxWidth().padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(ticket.reference, color = SupportGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text(ticket.status, color = SupportInk.copy(alpha = .6f), fontSize = 10.sp)
                        }
                        Text(ticket.subject, color = SupportInk, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text("Catégorie : ${ticket.category}", color = SupportInk.copy(alpha = .65f), fontSize = 11.sp)
                        Button(
                            onClick = { requestCall(ticket.id) },
                            enabled = !openingTicket && currentCall == null && ticket.status !in setOf("resolu", "ferme"),
                            modifier = Modifier.fillMaxWidth()
                        ) { Text(if (openingTicket) "Demande…" else "Demander un appel audio") }
                    }
                }
            }

            Text(
                "Le canal audio est privé. Le partage est déclenché séparément par l’utilisateur ; aucune image ni vidéo n’est stockée par NAXA.",
                color = SupportInk.copy(alpha = .55f),
                fontSize = 10.sp
            )
        }
    }

    if (newTicketVisible) {
        AlertDialog(
            onDismissRequest = { if (!creating) newTicketVisible = false },
            title = { Text("Nouvelle demande d’assistance") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = subject,
                        onValueChange = { subject = it },
                        label = { Text("Sujet (5–100 caractères)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = message,
                        onValueChange = { message = it },
                        label = { Text("Décrivez votre demande") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !creating && subject.trim().length in 5..100 && message.trim().isNotEmpty(),
                    onClick = {
                        scope.launch {
                            creating = true
                            ticketError = null
                            try {
                                val created = repository.createTicket("technique", subject, message)
                                tickets = listOf(created) + tickets
                                subject = ""
                                message = ""
                                newTicketVisible = false
                            } catch (error: Exception) {
                                ticketError = error.message ?: "La demande n’a pas été créée."
                            } finally {
                                creating = false
                            }
                        }
                    }
                ) { Text(if (creating) "Création…" else "Envoyer la demande") }
            },
            dismissButton = {
                TextButton(onClick = { newTicketVisible = false }, enabled = !creating) { Text("Annuler") }
            }
        )
    }
}

@Composable
private fun SupportErrorCard(message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFE9E7)), shape = RoundedCornerShape(13.dp)) {
        Text(message, Modifier.fillMaxWidth().padding(12.dp), color = Color(0xFF8A2018), fontSize = 12.sp)
    }
}

@Composable
private fun SupportInfoCard(title: String, message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
        Column(Modifier.padding(15.dp)) {
            Text(title, color = SupportInk, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text(message, color = SupportInk.copy(alpha = .7f), fontSize = 12.sp)
        }
    }
}

private fun supportCallStatus(status: String) = when (status) {
    "queued" -> "Demande en file d’attente"
    "ringing" -> "Un Agent est appelé"
    "accepted" -> "Appel en cours"
    "completed" -> "Appel terminé"
    "cancelled" -> "Demande annulée"
    "failed" -> "Appel interrompu"
    "missed" -> "Aucun Agent n’a pu prendre l’appel"
    "declined" -> "Demande refusée"
    else -> status
}
