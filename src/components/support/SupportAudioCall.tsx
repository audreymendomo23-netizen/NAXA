"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = { ticketId: string; mode: "requester" | "agent"; initialCallId?: string | null };
type CallState = "queued" | "ringing" | "accepted" | "cancelled" | "declined" | "completed" | "failed" | "missed";
type Signal = { kind: "ready" | "restart-request" | "offer" | "answer" | "candidate" | "hangup"; sdp?: string; candidate?: RTCIceCandidateInit };

export function SupportAudioCall({ ticketId, mode, initialCallId = null }: Props) {
  const [callId, setCallId] = useState<string | null>(initialCallId);
  const [status, setStatus] = useState<CallState | null>(initialCallId ? "accepted" : null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedOutput, setSelectedOutput] = useState("default");
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const offerStarted = useRef(false);
  const readyReplySent = useRef(false);
  const supabase = useMemo(() => supabaseBrowser(), []);

  const stopMedia = useCallback(() => {
    peer.current?.close();
    peer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
    if (channel.current) void supabase.removeChannel(channel.current);
    channel.current = null;
    pendingCandidates.current = [];
    offerStarted.current = false;
    readyReplySent.current = false;
    setConnected(false);
  }, [supabase]);

  const sendSignal = useCallback(async (payload: Signal) => {
    if (!channel.current) return;
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
          setNotice("L’appel est terminé : " + data.call.status + ".");
          stopMedia();
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
    if (!callId || status !== "accepted" || channel.current) return;
    let active = true;
    const connect = async () => {
      try {
        const response = await fetch("/api/support/calls/" + encodeURIComponent(callId) + "/ice", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Configuration TURN indisponible.");
        if (!active) return;

        const pc = new RTCPeerConnection({ iceServers: data.iceServers as RTCIceServer[] });
        peer.current = pc;
        pc.ontrack = (event) => {
          if (remoteAudio.current) {
            remoteAudio.current.srcObject = event.streams[0];
            void remoteAudio.current.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
          }
        };
        pc.onicecandidate = (event) => {
          if (event.candidate) void sendSignal({ kind: "candidate", candidate: event.candidate.toJSON() }).catch((cause) => setError(cause instanceof Error ? cause.message : "Envoi du candidat réseau impossible."));
        };
        pc.onconnectionstatechange = () => {
          setConnected(pc.connectionState === "connected");
          if (pc.connectionState === "failed") setError("La connexion audio a échoué. Vérifie le réseau et le relais TURN.");
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
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendSignal({ kind: "answer", sdp: answer.sdp ?? undefined });
            } else if (signal.kind === "answer" && mode === "agent" && signal.sdp) {
              await pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
              for (const candidate of pendingCandidates.current.splice(0)) await pc.addIceCandidate(candidate);
            } else if (signal.kind === "candidate" && signal.candidate) {
              if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
              else pendingCandidates.current.push(signal.candidate);
            } else if (signal.kind === "hangup") {
              setNotice("L’autre participant a terminé l’appel.");
              stopMedia();
            }
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "La négociation audio a échoué.");
          }
        });

        realtime.subscribe((state) => {
          if (!active) return;
          if (state === "SUBSCRIBED") void sendSignal({ kind: "ready" }).catch((cause) => setError(cause instanceof Error ? cause.message : "Signalisation indisponible."));
          if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            setError("La signalisation audio est interrompue. Réessaie ou poursuis par Livechat.");
          }
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Préparation de l’appel impossible.");
      }
    };
    void connect();
    return () => { active = false; };
  }, [callId, status, mode, sendSignal, startMedia, stopMedia, supabase]);

  useEffect(() => () => {
    peer.current?.close();
    stream.current?.getTracks().forEach((track) => track.stop());
    if (channel.current) void supabase.removeChannel(channel.current);
  }, [supabase]);

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
      try { await sendSignal({ kind: "hangup" }); } catch { /* La transition serveur reste prioritaire sur le signal best-effort. */ }
      const response = await fetch("/api/support/calls/" + encodeURIComponent(callId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action d’appel impossible.");
      setStatus(data.call.status as CallState);
      stopMedia();
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

  async function retryConnection() {
    setError("");
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
          <p className="mt-1 text-xs text-slate-600">Audio uniquement · aucun enregistrement · retour au Livechat possible.</p>
        </div>
        {connected && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">Connecté</span>}
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}
      <audio ref={remoteAudio} autoPlay playsInline />
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
            {error && <button type="button" disabled={busy} onClick={() => void retryConnection()} className="min-h-10 rounded-xl border border-amber-500 px-3 py-2 text-xs font-bold text-amber-900">Réessayer la connexion audio</button>}
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
