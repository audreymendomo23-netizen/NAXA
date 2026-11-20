"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = { ticketId: string; mode: "requester" | "agent"; initialCallId?: string | null };
type CallState = "queued" | "ringing" | "accepted" | "cancelled" | "declined" | "completed" | "failed" | "missed";
type Signal = {
  kind: "ready" | "restart-request" | "offer" | "answer" | "candidate" | "hangup"
    | "screen-share-started" | "screen-share-stopped";
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  shareSessionId?: string;
};
type ScreenShareReason = "browser_permission_denied" | "browser_unsupported" | "user_cancelled" | "user_stopped" | "call_ended" | "requester_disconnected" | "unexpected_track_end";
const subscribeScreenShareSupport = () => () => {};
const getScreenShareSupport = () => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
const getServerScreenShareSupport = () => false;

export function SupportAudioCall({ ticketId, mode, initialCallId = null }: Props) {
  const [callId, setCallId] = useState<string | null>(initialCallId);
  const [status, setStatus] = useState<CallState | null>(initialCallId ? "accepted" : null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [realtimeRetry, setRealtimeRetry] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedOutput, setSelectedOutput] = useState("default");
  const [screenShareConsent, setScreenShareConsent] = useState(false);
  const [screenShareBusy, setScreenShareBusy] = useState(false);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [remoteScreenActive, setRemoteScreenActive] = useState(false);
  const [remoteScreenResuming, setRemoteScreenResuming] = useState(false);
  const screenShareSupported = useSyncExternalStore(subscribeScreenShareSupport, getScreenShareSupport, getServerScreenShareSupport);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const localScreenPreview = useRef<HTMLVideoElement | null>(null);
  const remoteScreenPreview = useRef<HTMLVideoElement | null>(null);
  const remoteScreenResumeGeneration = useRef(0);
  const remoteScreenFrameCleanup = useRef<(() => void) | null>(null);
  const remoteScreenShareSessionId = useRef<string | null>(null);
  const screenShareStream = useRef<MediaStream | null>(null);
  const screenShareSender = useRef<RTCRtpSender | null>(null);
  const screenShareSessionId = useRef<string | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const offerStarted = useRef(false);
  const readyReplySent = useRef(false);
  const supabase = useMemo(() => supabaseBrowser(), []);

  const postScreenShareEvent = useCallback(async (
    action: "consented" | "started" | "stopped" | "denied",
    shareSessionId: string,
    reason?: ScreenShareReason,
  ) => {
    if (!callId) throw new Error("Aucun appel actif pour journaliser le partage écran.");
    const response = await fetch("/api/support/calls/" + encodeURIComponent(callId) + "/screen-share", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ action, share_session_id: shareSessionId, ...(reason ? { reason } : {}) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Le journal de consentement du partage écran est indisponible.");
  }, [callId]);

  const stopScreenShare = useCallback(async (reason: ScreenShareReason = "user_stopped", audit = true) => {
    const shareSessionId = screenShareSessionId.current;
    const capture = screenShareStream.current;
    const sender = screenShareSender.current;
    screenShareSessionId.current = null;
    screenShareStream.current = null;
    setScreenShareBusy(true);
    setScreenShareActive(false);
    setScreenShareConsent(false);
    if (localScreenPreview.current) localScreenPreview.current.srcObject = null;
    try {
      if (sender && peer.current?.signalingState !== "closed") {
        try { await sender.replaceTrack(null); } catch { /* Local capture is still stopped below. */ }
      }
      capture?.getTracks().forEach((track) => track.stop());
      // A negotiated receiver track can remain live after replaceTrack(null).
      // Explicitly tell the Agent to hide the preview; mute/ended remain fallback.
      if (shareSessionId && channel.current) {
        try {
          const result = await channel.current.send({
            type: "broadcast",
            event: "signal",
            payload: { kind: "screen-share-stopped", shareSessionId } satisfies Signal,
          });
          if (result !== "ok") throw new Error("Signal d’arrêt non confirmé.");
        } catch {
          setNotice("L’écran est arrêté sur cet appareil. L’affichage distant se synchronise.");
        }
      }
      if (shareSessionId && audit) {
        try { await postScreenShareEvent("stopped", shareSessionId, reason); }
        catch { setError("L’écran a été arrêté localement, mais la confirmation d’arrêt n’a pas pu être journalisée."); }
      }
    } finally {
      setScreenShareBusy(false);
    }
  }, [postScreenShareEvent]);

  useEffect(() => {
    if (!screenShareActive) return;
    const preview = localScreenPreview.current;
    const capture = screenShareStream.current;
    if (!preview || !capture) return;
    preview.srcObject = capture;
    void preview.play().catch(() => {
      setError("L’aperçu local du partage est indisponible dans ce navigateur.");
    });
    return () => {
      if (preview.srcObject === capture) preview.srcObject = null;
    };
  }, [screenShareActive]);

  const cancelRemoteScreenFrameWait = useCallback(() => {
    remoteScreenResumeGeneration.current += 1;
    remoteScreenFrameCleanup.current?.();
    remoteScreenFrameCleanup.current = null;
  }, []);

  const resumeRemoteScreenPreview = useCallback(async () => {
    const preview = remoteScreenPreview.current;
    const track = preview?.srcObject?.getVideoTracks?.()[0];
    if (!preview || !track || track.readyState !== "live" || track.muted) return;

    cancelRemoteScreenFrameWait();
    const generation = remoteScreenResumeGeneration.current;
    const baselineMediaTime = preview.currentTime;
    setRemoteScreenActive(false);
    setRemoteScreenResuming(true);

    try {
      // Keep the element decoding while transparent. display:none may prevent
      // frame presentation and leave requestVideoFrameCallback waiting forever.
      await preview.play();
      if (generation !== remoteScreenResumeGeneration.current) return;

      const isCurrent = () => generation === remoteScreenResumeGeneration.current
        && remoteScreenPreview.current === preview
        && track.readyState === "live"
        && track.muted === false;

      const activateOnFreshFrame = () => {
        if (!isCurrent()) return;
        remoteScreenFrameCleanup.current = null;
        setRemoteScreenResuming(false);
        setRemoteScreenActive(true);
      };

      if (typeof preview.requestVideoFrameCallback === "function") {
        let callbackId: number | null = null;
        const waitForFreshFrame = (_now: number, metadata: { mediaTime: number }) => {
          callbackId = null;
          if (generation !== remoteScreenResumeGeneration.current) return;
          if (!isCurrent()) {
            cancelRemoteScreenFrameWait();
            setRemoteScreenResuming(false);
            return;
          }
          if (metadata.mediaTime > baselineMediaTime + 0.001) {
            activateOnFreshFrame();
            return;
          }
          callbackId = preview.requestVideoFrameCallback(waitForFreshFrame);
        };
        callbackId = preview.requestVideoFrameCallback(waitForFreshFrame);
        remoteScreenFrameCleanup.current = () => {
          if (callbackId !== null) preview.cancelVideoFrameCallback(callbackId);
          callbackId = null;
        };
        return;
      }

      // Fallback: wait for the media clock to advance, not retained dimensions.
      const waitForMediaClock = () => {
        if (generation !== remoteScreenResumeGeneration.current) return;
        if (!isCurrent()) {
          cancelRemoteScreenFrameWait();
          setRemoteScreenResuming(false);
          return;
        }
        if (preview.readyState >= 2 && preview.videoWidth > 0
          && preview.currentTime > baselineMediaTime + 0.001) activateOnFreshFrame();
      };
      preview.addEventListener("timeupdate", waitForMediaClock);
      preview.addEventListener("playing", waitForMediaClock);
      remoteScreenFrameCleanup.current = () => {
        preview.removeEventListener("timeupdate", waitForMediaClock);
        preview.removeEventListener("playing", waitForMediaClock);
      };
      waitForMediaClock();
    } catch {
      if (generation === remoteScreenResumeGeneration.current) {
        remoteScreenFrameCleanup.current = null;
        setRemoteScreenResuming(false);
        setRemoteScreenActive(false);
        setError("La vidéo de partage est reçue, mais sa lecture est bloquée par le navigateur.");
      }
    }
  }, [cancelRemoteScreenFrameWait]);

  const stopMedia = useCallback((reason: ScreenShareReason = "unexpected_track_end") => {
    void stopScreenShare(reason);
    cancelRemoteScreenFrameWait();
    remoteScreenShareSessionId.current = null;
    setRemoteScreenResuming(false);
    peer.current?.close();
    peer.current = null;
    screenShareSender.current = null;
    if (remoteScreenPreview.current) remoteScreenPreview.current.srcObject = null;
    setRemoteScreenActive(false);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
    if (channel.current) void supabase.removeChannel(channel.current);
    channel.current = null;
    pendingCandidates.current = [];
    offerStarted.current = false;
    readyReplySent.current = false;
    setConnected(false);
    setRealtimeStatus("connecting");
  }, [supabase, stopScreenShare, cancelRemoteScreenFrameWait]);

  const sendSignal = useCallback(async (payload: Signal) => {
    if (!channel.current) throw new Error("Le canal privé de signalisation n’est pas prêt.");
    const result = await channel.current.send({ type: "broadcast", event: "signal", payload });
    if (result !== "ok") throw new Error("La signalisation audio privée n’a pas confirmé la livraison.");
  }, []);

  const startMedia = useCallback(async () => {
    if (stream.current) return stream.current;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Accès microphone HTTPS indisponible.");
    const local = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.current = local;
    return local;
  }, []);

  useEffect(() => {
    if (!callId) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch("/api/support/calls/" + encodeURIComponent(callId), { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "État de l’appel indisponible.");
        if (!active) return;
        setStatus(data.call.status as CallState);
        if (["cancelled", "declined", "completed", "failed", "missed"].includes(data.call.status)) {
          const terminalMessage = data.call.status === "missed"
            ? "Aucun Agent n’a pu prendre l’appel dans le délai prévu. Le Livechat écrit reste disponible."
            : data.call.status === "failed"
              ? "La session audio s’est interrompue. Le Livechat écrit reste disponible."
              : "L’appel est terminé : " + data.call.status + ".";
          setNotice(terminalMessage);
          stopMedia("call_ended");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "État de l’appel indisponible.");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [callId, stopMedia]);

  useEffect(() => {
    if (!callId || !status || ["cancelled", "declined", "completed", "failed", "missed"].includes(status)) return;
    let active = true;
    const heartbeat = async () => {
      try {
        const response = await fetch("/api/support/calls/" + encodeURIComponent(callId) + "/heartbeat", {
          method: "POST",
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "La session d’appel a expiré.");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Heartbeat audio indisponible.");
      }
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [callId, status]);

  useEffect(() => {
    if (!callId || status !== "accepted") return;
    let active = true;
    let reconnectTimer: number | null = null;
    const authState = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        window.setTimeout(() => {
          if (active) {
            try {
              // In @supabase/supabase-js 2.45.4 setAuth returns void.
              // Its public contract is synchronous; catch only synchronous failures.
              supabase.realtime.setAuth(session.access_token);
            } catch {
              if (active) setRealtimeStatus("error");
            }
          }
        }, 0);
      }
    });
    const connect = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error("La session utilisateur n’est pas encore disponible pour la signalisation privée.");
        const callResponse = await fetch("/api/support/calls/" + encodeURIComponent(callId), { cache: "no-store" });
        const callState = await callResponse.json();
        if (!callResponse.ok) throw new Error(callState.error || "Participants de l’appel indisponibles.");
        const userId = sessionData.session.user.id;
        if (userId !== callState.call?.requester_user_id && userId !== callState.call?.agent_user_id) {
          throw new Error("Cette session n’est pas autorisée à rejoindre le canal de cet appel.");
        }
        await supabase.realtime.setAuth(sessionData.session.access_token);
        if (!active) return;
        setRealtimeStatus("connecting");
        const response = await fetch("/api/support/calls/" + encodeURIComponent(callId) + "/ice", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Configuration TURN indisponible.");
        if (!active) return;

        const pc = new RTCPeerConnection({ iceServers: data.iceServers as RTCIceServer[] });
        peer.current = pc;
        // The Agent is the offerer and negotiates one receive-only video m-line.
        // The requester binds to the transceiver created for that remote m-line:
        // WebRTC does not associate a disassociated addTransceiver() instance with
        // an incoming offer, so pre-creating one here would leave a stale sender.
        if (mode === "agent") {
          pc.addTransceiver("video", { direction: "recvonly" });
        }
        screenShareSender.current = null;
        pc.ontrack = (event) => {
          if (event.track.kind === "audio") {
            if (remoteAudio.current) {
              remoteAudio.current.srcObject = event.streams[0] ?? new MediaStream([event.track]);
              void remoteAudio.current.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
            }
            return;
          }
          if (event.track.kind === "video" && mode === "agent") {
            const preview = remoteScreenPreview.current;
            if (!preview) {
              setError("La piste vidéo est arrivée avant que l’aperçu distant soit disponible.");
              return;
            }
            const remoteTrack = event.track;
            preview.srcObject = event.streams[0] ?? new MediaStream([remoteTrack]);
            setRemoteScreenActive(false);
            setRemoteScreenResuming(false);
            // A second replaceTrack can keep this receiver live/unmuted and emit
            // no new unmute event. The explicit start signal resumes this element.
            const showReceivedFrames = () => {
              if (remoteTrack.muted === true || remoteTrack.readyState !== "live") return;
              void resumeRemoteScreenPreview();
            };
            remoteTrack.addEventListener("unmute", showReceivedFrames);
            remoteTrack.addEventListener("mute", () => {
              cancelRemoteScreenFrameWait();
              setRemoteScreenResuming(false);
              setRemoteScreenActive(false);
            });
            remoteTrack.addEventListener("ended", () => {
              cancelRemoteScreenFrameWait();
              remoteScreenShareSessionId.current = null;
              if (remoteScreenPreview.current) remoteScreenPreview.current.srcObject = null;
              setRemoteScreenResuming(false);
              setRemoteScreenActive(false);
            }, { once: true });
            if (remoteTrack.muted === false) showReceivedFrames();
          }
        };
        pc.onicecandidate = (event) => {
          if (event.candidate) void sendSignal({ kind: "candidate", candidate: event.candidate.toJSON() }).catch((cause) => setError(cause instanceof Error ? cause.message : "Envoi du candidat réseau impossible."));
        };
        pc.onconnectionstatechange = () => {
          const connectionState = pc.connectionState;
          setConnected(connectionState === "connected");
          if (connectionState === "connected") {
            if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
            setError("");
            setNotice("Connexion audio rétablie.");
            return;
          }
          if (connectionState === "disconnected" || connectionState === "failed") {
            setNotice("Reconnexion audio en cours. Le chat écrit reste disponible.");
            if (mode === "requester") {
              void sendSignal({ kind: "restart-request" }).catch((cause) => {
                setError(cause instanceof Error ? cause.message : "Relance ICE impossible.");
              });
            }
            if (reconnectTimer === null) {
              reconnectTimer = window.setTimeout(async () => {
                if (pc.connectionState === "connected") return;
                try {
                  const response = await fetch("/api/support/calls/" + encodeURIComponent(callId), {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "fail" }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error || "La reconnexion audio a expiré.");
                  setStatus(data.call.status as CallState);
                  setNotice("La reconnexion n’a pas abouti en 20 secondes. Le Livechat écrit reste disponible.");
                  stopMedia("call_ended");
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "La reconnexion audio a expiré.");
                }
              }, 20_000);
            }
          }
        };

        const realtime = supabase.channel("naxa-support-call:" + callId, {
          config: { private: true, broadcast: { ack: true } },
        });
        channel.current = realtime;

        realtime.on("broadcast", { event: "signal" }, async ({ payload }) => {
          const signal = payload as Signal;
          try {
            if (signal.kind === "ready" && mode === "agent" && !offerStarted.current) {
              offerStarted.current = true;
              const local = await startMedia();
              local.getAudioTracks().forEach((track) => {
                if (!pc.getSenders().some((sender) => sender.track?.id === track.id)) pc.addTrack(track, local);
              });
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await sendSignal({ kind: "offer", sdp: offer.sdp ?? undefined });
            } else if (signal.kind === "ready" && mode === "requester" && !readyReplySent.current) {
              readyReplySent.current = true;
              await sendSignal({ kind: "ready" });
            } else if (signal.kind === "restart-request" && mode === "agent") {
              const iceResponse = await fetch("/api/support/calls/" + encodeURIComponent(callId) + "/ice", { cache: "no-store" });
              const iceData = await iceResponse.json();
              if (!iceResponse.ok) throw new Error(iceData.error || "Renouvellement TURN impossible.");
              pc.setConfiguration({ iceServers: iceData.iceServers as RTCIceServer[] });
              const restartOffer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(restartOffer);
              await sendSignal({ kind: "offer", sdp: restartOffer.sdp ?? undefined });
            } else if (signal.kind === "offer" && mode === "requester" && signal.sdp) {
              const local = await startMedia();
              local.getAudioTracks().forEach((track) => {
                if (!pc.getSenders().some((sender) => sender.track?.id === track.id)) pc.addTrack(track, local);
              });
              await pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });
              for (const candidate of pendingCandidates.current.splice(0)) await pc.addIceCandidate(candidate);
              const negotiatedVideo = pc.getTransceivers().find((transceiver) =>
                transceiver.mid !== null && transceiver.receiver.track.kind === "video"
              );
              if (!negotiatedVideo) {
                throw new Error("L’offre Agent ne contient pas de m-line vidéo négocié.");
              }
              // The video transceiver created from the remote recvonly m-line
              // defaults to recvonly locally. That would produce an inactive
              // answer because no display track exists yet. Reserve the m-line
              // as sendonly now; replaceTrack() supplies the user-selected source
              // later without renegotiation or capturing before consent.
              negotiatedVideo.direction = "sendonly";
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              if (!negotiatedVideo.currentDirection?.includes("send")) {
                throw new Error("Le SDP de réponse ne négocie pas l’émission vidéo vers l’Agent.");
              }
              screenShareSender.current = negotiatedVideo.sender;
              await sendSignal({ kind: "answer", sdp: answer.sdp ?? undefined });
            } else if (signal.kind === "answer" && mode === "agent" && signal.sdp) {
              await pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
              for (const candidate of pendingCandidates.current.splice(0)) await pc.addIceCandidate(candidate);
            } else if (signal.kind === "candidate" && signal.candidate) {
              if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
              else pendingCandidates.current.push(signal.candidate);
            } else if (signal.kind === "screen-share-started" && mode === "agent") {
              if (!signal.shareSessionId) throw new Error("Session de partage distante absente.");
              remoteScreenShareSessionId.current = signal.shareSessionId;
              // Resume the existing receiver without renegotiation; keep it
              // transparent until a frame from this new session is presented.
              void resumeRemoteScreenPreview();
            } else if (signal.kind === "screen-share-stopped" && mode === "agent") {
              if (signal.shareSessionId && remoteScreenShareSessionId.current
                && signal.shareSessionId !== remoteScreenShareSessionId.current) return;
              remoteScreenShareSessionId.current = null;
              cancelRemoteScreenFrameWait();
              remoteScreenPreview.current?.pause();
              setRemoteScreenResuming(false);
              setRemoteScreenActive(false);
            } else if (signal.kind === "hangup") {
              setNotice("L’autre participant a terminé l’appel.");
              stopMedia("call_ended");
            }
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "La négociation audio a échoué.");
          }
        });

        realtime.subscribe((state, subscriptionError) => {
          if (!active) return;
          if (state === "SUBSCRIBED") {
            setRealtimeStatus("connected");
            void sendSignal({ kind: "ready" }).catch((cause) => {
              setRealtimeStatus("error");
              setError(cause instanceof Error ? cause.message : "Signalisation indisponible.");
            });
          }
          if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            setRealtimeStatus("error");
            setError(subscriptionError?.message || "Le canal privé de signalisation a refusé ou perdu la connexion. Réessaie ou poursuis par Livechat.");
          }
        });
      } catch (cause) {
        setRealtimeStatus("error");
        setError(cause instanceof Error ? cause.message : "Préparation de l’appel impossible.");
      }
    };
    void connect();
    return () => {
      active = false;
      authState.data.subscription.unsubscribe();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    };
  }, [callId, status, mode, sendSignal, startMedia, stopMedia, supabase, realtimeRetry,
    cancelRemoteScreenFrameWait, resumeRemoteScreenPreview]);

  useEffect(() => () => {
    cancelRemoteScreenFrameWait();
    remoteScreenShareSessionId.current = null;
    const shareSessionId = screenShareSessionId.current;
    screenShareSessionId.current = null;
    screenShareStream.current?.getTracks().forEach((track) => track.stop());
    screenShareStream.current = null;
    void screenShareSender.current?.replaceTrack(null).catch(() => undefined);
    if (shareSessionId) void postScreenShareEvent("stopped", shareSessionId, "requester_disconnected").catch(() => undefined);
    peer.current?.close();
    stream.current?.getTracks().forEach((track) => track.stop());
    if (channel.current) void supabase.removeChannel(channel.current);
  }, [supabase, postScreenShareEvent, cancelRemoteScreenFrameWait]);

  async function requestCall() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/support/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Demande d’appel impossible.");
      setCallId(data.call.id);
      setStatus(data.call.status as CallState);
      setNotice(data.call.status === "ringing"
        ? "Votre Agent est appelé en priorité."
        : "Votre demande est dans la file centrale ; le Livechat reste disponible.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demande d’appel impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: "cancel" | "end") {
    if (!callId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/support/calls/" + encodeURIComponent(callId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action d’appel impossible.");
      setStatus(data.call.status as CallState);
      stopMedia();
      // The server transition is authoritative. The remote peer discovers it through
      // the call-state poll; an unacknowledged Realtime broadcast must never delay hangup.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action d’appel impossible.");
    } finally {
      setBusy(false);
    }
  }

  function toggleMute() {
    const next = !muted;
    stream.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }

  async function activateRemoteAudio() {
    try {
      await remoteAudio.current?.play();
      setAudioBlocked(false);
    } catch {
      setAudioBlocked(true);
      setError("Le navigateur bloque encore le son. Autorise la lecture audio pour ce site.");
    }
  }

  async function startScreenShare() {
    if (mode !== "requester" || !callId || status !== "accepted" || !connected) return;
    if (!screenShareConsent) {
      setError("Confirmez votre accord NAXA avant de choisir l’écran à partager.");
      return;
    }
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getDisplayMedia) {
      setError("Le partage d’écran n’est pas pris en charge dans ce navigateur. L’audio et le Livechat restent disponibles.");
      return;
    }
    const shareSessionId = crypto.randomUUID();
    let startedAuditPersisted = false;
    let capturePromise: Promise<MediaStream>;
    try {
      // getDisplayMedia must be called in the user's click gesture before any await.
      capturePromise = mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 24 } },
        audio: false,
      });
    } catch (cause) {
      const reason: ScreenShareReason = cause instanceof DOMException && cause.name === "SecurityError"
        ? "browser_unsupported" : "browser_permission_denied";
      void postScreenShareEvent("denied", shareSessionId, reason).catch(() => undefined);
      setError("Le navigateur n’a pas autorisé le partage d’écran. Aucune image n’a été transmise.");
      return;
    }
    setScreenShareBusy(true);
    setError("");
    try {
      const capture = await capturePromise;
      const track = capture.getVideoTracks()[0];
      const sender = screenShareSender.current;
      if (!track || !sender || !peer.current || peer.current.connectionState !== "connected") {
        capture.getTracks().forEach((item) => item.stop());
        throw new Error("La session audio n’est pas prête à recevoir le partage écran.");
      }
      const transceiver = peer.current.getTransceivers().find((item) => item.sender === sender);
      if (!transceiver || transceiver.mid === null || !transceiver.currentDirection?.includes("send")) {
        capture.getTracks().forEach((item) => item.stop());
        throw new Error("Le flux vidéo n’est pas lié au transceiver SDP négocié. Relancez l’appel avant de partager.");
      }
      screenShareStream.current = capture;
      screenShareSessionId.current = shareSessionId;
      // The local preview is mounted after screenShareActive changes; an effect
      // attaches this stream once React has rendered the video element.
      // Native browser source selection is the second consent step.
      await postScreenShareEvent("consented", shareSessionId);
      await sender.replaceTrack(track);
      await postScreenShareEvent("started", shareSessionId);
      startedAuditPersisted = true;
      await sendSignal({ kind: "screen-share-started", shareSessionId });
      track.addEventListener("ended", () => void stopScreenShare("user_stopped"), { once: true });
      setScreenShareActive(true);
      setNotice("Votre écran est partagé avec l’Agent. Vous pouvez arrêter à tout moment.");
    } catch (cause) {
      await screenShareSender.current?.replaceTrack(null).catch(() => undefined);
      screenShareStream.current?.getTracks().forEach((track) => track.stop());
      screenShareStream.current = null;
      screenShareSessionId.current = null;
      setScreenShareConsent(false);
      if (localScreenPreview.current) localScreenPreview.current.srcObject = null;
      setScreenShareActive(false);
      if (startedAuditPersisted) {
        // A signal failure after the started audit is a transport stop, not an
        // operating-system picker denial. Keep the persisted lifecycle truthful.
        await postScreenShareEvent("stopped", shareSessionId, "unexpected_track_end").catch(() => undefined);
        await channel.current?.send({
          type: "broadcast", event: "signal",
          payload: { kind: "screen-share-stopped", shareSessionId } satisfies Signal,
        }).catch(() => undefined);
      } else {
        const reason: ScreenShareReason = cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "browser_permission_denied"
          : cause instanceof DOMException && ["AbortError", "NotFoundError"].includes(cause.name)
            ? "user_cancelled" : "browser_unsupported";
        await postScreenShareEvent("denied", shareSessionId, reason).catch(() => undefined);
      }
      setError(cause instanceof Error ? cause.message : "Le partage d’écran n’a pas pu démarrer.");
    } finally {
      setScreenShareBusy(false);
    }
  }

  async function retryConnection() {
    setError("");
    if (!callId) return;
    if (realtimeStatus !== "connected" || !channel.current || !peer.current) {
      stopMedia("unexpected_track_end");
      setRealtimeStatus("connecting");
      setRealtimeRetry((value) => value + 1);
      setNotice("Recréation du canal privé et de la session média…");
      return;
    }
    try {
      if (mode === "requester") {
        await sendSignal({ kind: "restart-request" });
      } else {
        const iceResponse = await fetch("/api/support/calls/" + encodeURIComponent(callId ?? "") + "/ice", { cache: "no-store" });
        const iceData = await iceResponse.json();
        if (!iceResponse.ok) throw new Error(iceData.error || "Renouvellement TURN impossible.");
        if (!peer.current) throw new Error("La session audio n’est pas prête.");
        peer.current.setConfiguration({ iceServers: iceData.iceServers as RTCIceServer[] });
        const restartOffer = await peer.current.createOffer({ iceRestart: true });
        await peer.current.setLocalDescription(restartOffer);
        await sendSignal({ kind: "offer", sdp: restartOffer.sdp ?? undefined });
      }
      setNotice("Reconnexion audio demandée…");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La reconnexion audio a échoué.");
    }
  }

  async function changeOutput(deviceId: string) {
    const audio = remoteAudio.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    setSelectedOutput(deviceId);
    if (!audio?.setSinkId) {
      setError("Le navigateur ne permet pas de changer la sortie audio sur cet appareil.");
      return;
    }
    try {
      await audio.setSinkId(deviceId);
      setError("");
    } catch {
      setError("La sortie audio sélectionnée n’est pas disponible.");
    }
  }

  useEffect(() => {
    if (!callId || status !== "accepted" || !navigator.mediaDevices?.enumerateDevices) return;
    let active = true;
    void navigator.mediaDevices.enumerateDevices().then((devices) => {
      if (!active) return;
      const outputs = devices.filter((device) => device.kind === "audiooutput")
        .map((device, index) => ({ deviceId: device.deviceId || "default", label: device.label || (index === 0 ? "Sortie par défaut" : "Sortie audio " + (index + 1)) }));
      setAudioOutputs(outputs);
    }).catch(() => setAudioOutputs([]));
    return () => { active = false; };
  }, [callId, status]);

  if (mode === "agent" && !initialCallId) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm" aria-label="Appel audio NAXA">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-extrabold text-emerald-950">Appel audio NAXA</h3>
          <p className="mt-1 text-xs text-slate-600">Audio · partage d’écran facultatif · aucun enregistrement ni contrôle à distance.</p>
        </div>
        {connected && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">Connecté</span>}
      </div>
      {status === "accepted" && <p role="status" className="text-xs text-slate-500">
        {realtimeStatus === "connected" ? "Canal sécurisé connecté" : realtimeStatus === "connecting" ? "Connexion sécurisée en cours…" : "Canal sécurisé interrompu"}
      </p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}
      <audio ref={remoteAudio} autoPlay playsInline />
      {mode === "requester" && status === "accepted" && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-start gap-2 text-xs leading-5 text-slate-700">
            <input type="checkbox" checked={screenShareConsent} onChange={(event) => setScreenShareConsent(event.target.checked)} disabled={screenShareActive || screenShareBusy} className="mt-1" />
            <span>J’accepte de partager mon écran avec l’Agent NAXA. Seule la source que je sélectionne dans le navigateur sera visible. Aucun contrôle à distance ni enregistrement n’est autorisé.</span>
          </label>
          {!screenShareSupported && <p className="text-xs text-amber-800">Ce navigateur ne propose pas le partage d’écran. L’assistance audio et le Livechat restent disponibles.</p>}
          {screenShareActive ? (
            <div className="space-y-2">
              <video ref={localScreenPreview} autoPlay playsInline muted aria-label="Aperçu de votre écran partagé" className="max-h-56 w-full rounded-lg border border-slate-200 bg-black object-contain" />
              <button type="button" disabled={screenShareBusy} onClick={() => void stopScreenShare("user_stopped")} className="min-h-10 rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white">Arrêter le partage</button>
            </div>
          ) : (
            <button type="button" disabled={!screenShareConsent || !screenShareSupported || !connected || screenShareBusy} onClick={() => void startScreenShare()} className="min-h-10 rounded-xl border border-emerald-800 px-3 py-2 text-xs font-bold text-emerald-900 disabled:opacity-40">
              {screenShareBusy ? "Ouverture du sélecteur…" : "Partager mon écran"}
            </button>
          )}
        </div>
      )}
      {mode === "agent" && status === "accepted" && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">{remoteScreenActive ? "Écran partagé par le demandeur" : "Aucun écran partagé par le demandeur"}</p>
          <video ref={remoteScreenPreview} autoPlay playsInline muted aria-label="Écran partagé par le demandeur" className={remoteScreenActive
            ? "max-h-72 w-full rounded-lg border border-slate-200 bg-black object-contain"
            : remoteScreenResuming
              ? "max-h-72 w-full rounded-lg border border-slate-200 bg-black object-contain opacity-0 pointer-events-none"
              : "hidden"} />
          <p className="text-[11px] text-slate-500">Affichage uniquement · aucun contrôle à distance.</p>
        </div>
      )}
      {audioOutputs.length > 1 && <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">Sortie audio<select value={selectedOutput} onChange={(event) => void changeOutput(event.target.value)} className="rounded-lg border border-slate-300 p-2"><option value="default">Sortie par défaut</option>{audioOutputs.filter((device) => device.deviceId !== "default").map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}</select></label>}
      {audioBlocked && <button type="button" onClick={() => void activateRemoteAudio()} className="min-h-10 rounded-xl border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-900">Activer le son reçu</button>}
      {mode === "requester" && !callId && (
        <button type="button" disabled={busy} onClick={() => void requestCall()} className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "Préparation…" : "Demander un appel audio"}
        </button>
      )}
      {callId && status && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
            {status === "queued" ? "En attente dans la file" : status === "ringing" ? "Agent appelé" : status === "accepted" ? "Appel en cours" : "Appel terminé"}
          </span>
          {status === "accepted" && <>
            {(error || realtimeStatus !== "connected") && <button type="button" disabled={busy} onClick={() => void retryConnection()} className="min-h-10 rounded-xl border border-amber-500 px-3 py-2 text-xs font-bold text-amber-900">Réessayer la connexion sécurisée</button>}
            <button type="button" onClick={toggleMute} className="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">{muted ? "Réactiver le micro" : "Couper le micro"}</button>
            <button type="button" disabled={busy} onClick={() => void transition("end")} className="min-h-10 rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white">Raccrocher</button>
          </>}
          {(status === "queued" || status === "ringing") && mode === "requester" && (
            <button type="button" disabled={busy} onClick={() => void transition("cancel")} className="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Annuler la demande</button>
          )}
        </div>
      )}
    </section>
  );
}
