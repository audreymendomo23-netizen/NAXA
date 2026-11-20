package cm.naxa.app

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.util.DisplayMetrics
import android.view.WindowManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpSender
import org.webrtc.RtpTransceiver
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Native requester side of the existing web Support WebRTC call.
 * Agent remains the existing browser Support workspace. The requester never
 * receives a remote-control channel and never captures system audio.
 */
class NativeSupportRtcClient(
    private val context: Context,
    private val repository: NativeSupportRepository,
    private val onStatus: (String) -> Unit
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val shareMutex = Mutex()
    private val pendingCandidates = CopyOnWriteArrayList<IceCandidate>()
    private var peer: PeerConnection? = null
    private var channel: NaxaSupportRealtime? = null
    private var factory: PeerConnectionFactory? = null
    private var egl: EglBase? = null
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var negotiatedVideoSender: RtpSender? = null
    private var screenCapturer: ScreenCapturerAndroid? = null
    private var screenSource: VideoSource? = null
    private var screenTrack: VideoTrack? = null
    private var screenTextureHelper: SurfaceTextureHelper? = null
    private var currentShareSessionId: String? = null
    private var callId: String? = null
    @Volatile private var remoteDescriptionSet = false
    @Volatile private var readyReplySent = false
    @Volatile private var closed = false

    suspend fun prepare(
        id: String,
        iceServers: List<NativeIceServer>,
        realtime: NaxaSupportRealtime
    ) {
        check(!closed) { "La session audio native est déjà fermée." }
        callId = id
        channel = realtime
        NaxaMediaProjectionService.startAudio(context)
        ensureFactory()

        val rtcIceServers = iceServers.map { server ->
            PeerConnection.IceServer.builder(server.urls)
                .setUsername(server.username)
                .setPassword(server.credential)
                .createIceServer()
        }
        val configuration = PeerConnection.RTCConfiguration(rtcIceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            iceTransportsType = PeerConnection.IceTransportsType.RELAY
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
        }

        peer = factory?.createPeerConnection(configuration, observer())
            ?: throw IllegalStateException("La connexion WebRTC native n’a pas pu être créée.")

        val audioConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "true"))
        }
        audioSource = factory?.createAudioSource(audioConstraints)
            ?: throw IllegalStateException("La source audio native est indisponible.")
        audioTrack = factory?.createAudioTrack("naxa-support-microphone", audioSource).apply {
            this?.setEnabled(true)
        }
        val track = audioTrack ?: throw IllegalStateException("La piste microphone native est absente.")
        peer?.addTrack(track, listOf("naxa-support"))
        onStatus("connecting")
    }

    fun handleSignal(signal: JSONObject) {
        if (closed) return
        scope.launch {
            try {
                when (signal.optString("kind")) {
                    "ready" -> {
                        if (!readyReplySent) {
                            readyReplySent = true
                            channel?.broadcastSignal(JSONObject().put("kind", "ready"))
                        }
                    }
                    "offer" -> {
                        val sdp = signal.optString("sdp")
                        if (sdp.isNotBlank()) handleOffer(sdp)
                    }
                    "candidate" -> {
                        val raw = signal.optJSONObject("candidate") ?: return@launch
                        val candidate = IceCandidate(
                            raw.optString("sdpMid").takeIf { it.isNotBlank() && it != "null" },
                            raw.optInt("sdpMLineIndex"),
                            raw.optString("candidate")
                        )
                        if (remoteDescriptionSet) peer?.addIceCandidate(candidate)
                        else pendingCandidates.add(candidate)
                    }
                    "hangup", "screen-share-stopped" -> {
                        if (signal.optString("kind") == "hangup") {
                            stopScreenShare("call_ended", audit = false)
                            onStatus("ended")
                        }
                    }
                }
            } catch (error: Exception) {
                onStatus(error.message ?: "La signalisation WebRTC native a échoué.")
            }
        }
    }

    private suspend fun handleOffer(sdp: String) {
        val connection = peer ?: throw IllegalStateException("La connexion WebRTC n’est pas initialisée.")
        remoteDescriptionSet = false
        val remoteSet = kotlinx.coroutines.CompletableDeferred<Unit>()
        connection.setRemoteDescription(object : SdpObserver {
            override fun onCreateSuccess(description: SessionDescription?) = Unit
            override fun onSetSuccess() { remoteSet.complete(Unit) }
            override fun onCreateFailure(error: String?) {
                remoteSet.completeExceptionally(IllegalStateException(error ?: "Offre SDP invalide."))
            }
            override fun onSetFailure(error: String?) {
                remoteSet.completeExceptionally(IllegalStateException(error ?: "Impossible d’appliquer l’offre SDP."))
            }
        }, SessionDescription(SessionDescription.Type.OFFER, sdp))
        kotlinx.coroutines.withTimeout(10_000) { remoteSet.await() }
        remoteDescriptionSet = true
        pendingCandidates.toList().forEach { candidate ->
            connection.addIceCandidate(candidate)
            pendingCandidates.remove(candidate)
        }

        val videoTransceiver = connection.transceivers.firstOrNull {
            it.mediaType == org.webrtc.MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO
        } ?: throw IllegalStateException("L’offre Agent ne réserve pas de piste vidéo.")
        if (!videoTransceiver.setDirection(RtpTransceiver.RtpTransceiverDirection.SEND_ONLY)) {
            throw IllegalStateException("La piste vidéo native ne peut pas être négociée en émission.")
        }
        negotiatedVideoSender = videoTransceiver.sender

        val answerCreated = kotlinx.coroutines.CompletableDeferred<SessionDescription>()
        connection.createAnswer(object : SdpObserver {
            override fun onCreateSuccess(description: SessionDescription?) {
                if (description == null) answerCreated.completeExceptionally(
                    IllegalStateException("Réponse SDP absente.")
                ) else answerCreated.complete(description)
            }
            override fun onSetSuccess() = Unit
            override fun onCreateFailure(error: String?) {
                answerCreated.completeExceptionally(IllegalStateException(error ?: "Création de la réponse SDP impossible."))
            }
            override fun onSetFailure(error: String?) = Unit
        }, MediaConstraints())
        val answer = kotlinx.coroutines.withTimeout(10_000) { answerCreated.await() }

        val localSet = kotlinx.coroutines.CompletableDeferred<Unit>()
        connection.setLocalDescription(object : SdpObserver {
            override fun onCreateSuccess(description: SessionDescription?) = Unit
            override fun onSetSuccess() { localSet.complete(Unit) }
            override fun onCreateFailure(error: String?) = Unit
            override fun onSetFailure(error: String?) {
                localSet.completeExceptionally(IllegalStateException(error ?: "Impossible d’appliquer la réponse SDP."))
            }
        }, answer)
        kotlinx.coroutines.withTimeout(10_000) { localSet.await() }
        channel?.broadcastSignal(JSONObject().put("kind", "answer").put("sdp", answer.description))
    }

    suspend fun startScreenShare(permissionData: Intent, sessionId: String) = shareMutex.withLock {
        check(!closed) { "L’appel Support est terminé." }
        check(peer?.connectionState() == PeerConnection.PeerConnectionState.CONNECTED) {
            "Attendez que l’audio sécurisé soit connecté avant de partager l’écran."
        }
        val sender = negotiatedVideoSender
            ?: throw IllegalStateException("La piste vidéo n’a pas été négociée avec l’Agent.")
        check(currentShareSessionId == null) { "Un partage d’écran est déjà actif." }

        val id = callId ?: throw IllegalStateException("Aucun appel Support actif.")
        repository.screenShareEvent(id, sessionId, "consented")
        currentShareSessionId = sessionId

        var startEventRecorded = false
        try {
            // Await the OS foreground-service acknowledgment before asking WebRTC
            // to create the MediaProjection and its VirtualDisplay.
            NaxaMediaProjectionService.startProjection(context)
            val eglContext = egl?.eglBaseContext
                ?: throw IllegalStateException("Le moteur vidéo natif n’est pas prêt.")
            val capturer = ScreenCapturerAndroid(
                permissionData,
                object : MediaProjection.Callback() {
                    override fun onStop() {
                        scope.launch {
                            stopScreenShare("unexpected_track_end", audit = true)
                            onStatus("screen_stopped")
                        }
                    }
                }
            )
            screenCapturer = capturer
            val source = factory?.createVideoSource(true)
                ?: throw IllegalStateException("La source de capture MediaProjection est indisponible.")
            val textureHelper = SurfaceTextureHelper.create("NAXA-Screen-Capture", eglContext)
                ?: throw IllegalStateException("Le thread de capture écran ne peut pas être initialisé.")
            screenTextureHelper = textureHelper
            capturer.initialize(textureHelper, context.applicationContext, source.capturerObserver)
            screenSource = source
            val video = factory?.createVideoTrack("naxa-support-screen", source)
                ?: throw IllegalStateException("La piste vidéo native est indisponible.")
            screenTrack = video
            video.setEnabled(true)

            val metrics = DisplayMetrics()
            @Suppress("DEPRECATION")
            val display = (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay
            @Suppress("DEPRECATION")
            display.getRealMetrics(metrics)
            // Cap the longer edge at 1280 px, preserving portrait/landscape ratio
            // and avoiding unbounded 4K screen-share uplink from mobile devices.
            val longestEdge = maxOf(metrics.widthPixels, metrics.heightPixels).coerceAtLeast(1)
            val scale = minOf(1f, 1280f / longestEdge)
            val width = ((metrics.widthPixels * scale).toInt() / 2 * 2).coerceAtLeast(2)
            val height = ((metrics.heightPixels * scale).toInt() / 2 * 2).coerceAtLeast(2)

            if (!sender.setTrack(video, false)) {
                throw IllegalStateException("La piste vidéo n’a pas pu être attachée au transceiver négocié.")
            }
            capturer.startCapture(width, height, 15)
            repository.screenShareEvent(id, sessionId, "started")
            startEventRecorded = true
            channel?.broadcastSignal(
                JSONObject().put("kind", "screen-share-started").put("shareSessionId", sessionId)
            )
            onStatus("screen_sharing")
        } catch (error: Exception) {
            negotiatedVideoSender?.setTrack(null, false)
            runCatching { stopCaptureResources() }
            NaxaMediaProjectionService.stopProjection(context)
            currentShareSessionId = null
            runCatching {
                if (startEventRecorded) repository.screenShareEvent(id, sessionId, "stopped", "unexpected_track_end")
                else repository.screenShareEvent(id, sessionId, "denied", "unexpected_track_end")
            }
            throw error
        }
    }

    suspend fun stopScreenShare(reason: String = "user_stopped", audit: Boolean = true) =
        shareMutex.withLock {
            val id = callId
            val sessionId = currentShareSessionId ?: return@withLock
            val sender = negotiatedVideoSender
            currentShareSessionId = null
            try {
                sender?.setTrack(null, false)
                stopCaptureResources()
                NaxaMediaProjectionService.stopProjection(context)
                runCatching {
                    channel?.broadcastSignal(
                        JSONObject().put("kind", "screen-share-stopped").put("shareSessionId", sessionId)
                    )
                }
                if (audit && id != null) {
                    repository.screenShareEvent(id, sessionId, "stopped", reason)
                }
            } finally {
                onStatus("connected")
            }
        }

    private fun stopCaptureResources() {
        val capturer = screenCapturer
        screenCapturer = null
        if (capturer != null) {
            runCatching { capturer.stopCapture() }
            runCatching { capturer.dispose() }
        }
        screenTrack?.let { runCatching { it.setEnabled(false); it.dispose() } }
        screenTrack = null
        screenSource?.let { runCatching { it.dispose() } }
        screenSource = null
        screenTextureHelper?.let { runCatching { it.dispose() } }
        screenTextureHelper = null
    }

    private fun observer() = object : PeerConnection.Observer {
        override fun onSignalingChange(newState: PeerConnection.SignalingState) = Unit
        override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState) {
            when (newState) {
                PeerConnection.IceConnectionState.CONNECTED,
                PeerConnection.IceConnectionState.COMPLETED -> onStatus("connected")
                PeerConnection.IceConnectionState.DISCONNECTED -> onStatus("reconnecting")
                PeerConnection.IceConnectionState.FAILED -> {
                    onStatus("reconnecting")
                    scope.launch {
                        runCatching { channel?.broadcastSignal(JSONObject().put("kind", "restart-request")) }
                    }
                }
                else -> Unit
            }
        }
        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
            when (newState) {
                PeerConnection.PeerConnectionState.CONNECTED -> onStatus("connected")
                PeerConnection.PeerConnectionState.DISCONNECTED,
                PeerConnection.PeerConnectionState.CONNECTING -> onStatus("reconnecting")
                PeerConnection.PeerConnectionState.FAILED,
                PeerConnection.PeerConnectionState.CLOSED -> onStatus("disconnected")
                else -> Unit
            }
        }
        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
        override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState) = Unit
        override fun onIceCandidate(candidate: IceCandidate) {
            val signal = JSONObject()
                .put("kind", "candidate")
                .put("candidate", JSONObject()
                    .put("candidate", candidate.sdp)
                    .put("sdpMid", candidate.sdpMid)
                    .put("sdpMLineIndex", candidate.sdpMLineIndex))
            scope.launch { runCatching { channel?.broadcastSignal(signal) } }
        }
        override fun onIceCandidatesRemoved(candidates: Array<IceCandidate>) = Unit
        override fun onAddStream(stream: org.webrtc.MediaStream) = Unit
        override fun onRemoveStream(stream: org.webrtc.MediaStream) = Unit
        override fun onDataChannel(dataChannel: org.webrtc.DataChannel) = Unit
        override fun onRenegotiationNeeded() = Unit
        override fun onAddTrack(receiver: org.webrtc.RtpReceiver, mediaStreams: Array<org.webrtc.MediaStream>) {
            receiver.track()?.setEnabled(true)
        }
        override fun onTrack(transceiver: RtpTransceiver) {
            transceiver.receiver.track()?.setEnabled(true)
        }
    }

    private fun ensureFactory() {
        if (factory != null) return
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context.applicationContext)
                .setEnableInternalTracer(false)
                .createInitializationOptions()
        )
        val rootEgl = EglBase.create()
        egl = rootEgl
        val encoder = DefaultVideoEncoderFactory(rootEgl.eglBaseContext, true, true)
        val decoder = DefaultVideoDecoderFactory(rootEgl.eglBaseContext)
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoder)
            .setVideoDecoderFactory(decoder)
            .createPeerConnectionFactory()
    }

    fun close() {
        if (closed) return
        closed = true
        scope.launch {
            runCatching { stopScreenShare("call_ended", audit = false) }
            peer?.close()
            peer?.dispose()
            peer = null
            audioTrack?.setEnabled(false)
            audioTrack?.dispose()
            audioTrack = null
            audioSource?.dispose()
            audioSource = null
            factory?.dispose()
            factory = null
            NaxaMediaProjectionService.stop(context)
            egl?.release()
            egl = null
        }
    }
}
