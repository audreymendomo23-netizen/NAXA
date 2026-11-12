"use client";

import { useEffect, useRef, useState } from "react";

type SessionResponse = {
  ok: true;
  whepUrl: string;
  authorization: string;
  expiresAt: string;
  refreshAfterSeconds: number;
};

type PlayerStatus = "idle" | "authorizing" | "connecting" | "playing" | "error";

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };
    const onChange = () => {
      if (peer.iceGatheringState === "complete") finish();
    };
    const timeout = window.setTimeout(finish, 8000);
    peer.addEventListener("icegatheringstatechange", onChange);
  });
}

export function SecurityWhepPlayer({
  cameraId,
  compact = false,
}: {
  cameraId: string;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("idle");

  useEffect(() => {
    if (!active) return;

    let disposed = false;
    let peer: RTCPeerConnection | null = null;
    let resourceUrl: string | null = null;
    let authorization: string | null = null;
    let renewalTimer: number | null = null;
    const controller = new AbortController();

    const closeResource = async () => {
      if (renewalTimer !== null) window.clearTimeout(renewalTimer);
      renewalTimer = null;
      if (resourceUrl && authorization) {
        try {
          await fetch(resourceUrl, {
            method: "DELETE",
            headers: { Authorization: authorization },
            cache: "no-store",
          });
        } catch {
          // L'expiration MediaMTX reste la protection de secours.
        }
      }
      if (authorization) {
        try {
          await fetch("/api/security/cameras/live-session/revoke", {
            method: "POST",
            headers: { Authorization: authorization },
            cache: "no-store",
          });
        } catch {
          // Le ticket expire côté serveur même si la révocation réseau échoue.
        }
      }
      resourceUrl = null;
      authorization = null;
      if (peer) {
        peer.ontrack = null;
        peer.onconnectionstatechange = null;
        peer.close();
        peer = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const connect = async () => {
      setStatus("authorizing");
      try {
        const ticketResponse = await fetch("/api/security/cameras/live-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cameraId }),
          cache: "no-store",
          signal: controller.signal,
        });
        const ticket = await ticketResponse.json().catch(() => null);
        if (!ticketResponse.ok || !ticket || ticket.ok !== true) {
          throw new Error(typeof ticket?.error === "string" ? ticket.error : "Autorisation vidéo refusée.");
        }
        const session = ticket as SessionResponse;
        authorization = session.authorization;

        const nextPeer = new RTCPeerConnection();
        peer = nextPeer;
        nextPeer.addTransceiver("video", { direction: "recvonly" });
        nextPeer.addTransceiver("audio", { direction: "recvonly" });
        nextPeer.ontrack = (event) => {
          if (disposed || !videoRef.current) return;
          videoRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track]);
          setStatus("playing");
        };
        nextPeer.onconnectionstatechange = () => {
          if (disposed) return;
          if (nextPeer.connectionState === "failed" || nextPeer.connectionState === "disconnected") {
            setStatus("error");
          }
        };

        setStatus("connecting");
        const offer = await nextPeer.createOffer();
        await nextPeer.setLocalDescription(offer);
        await waitForIceGathering(nextPeer);
        if (disposed || controller.signal.aborted) return;

        const whepResponse = await fetch(session.whepUrl, {
          method: "POST",
          headers: {
            Authorization: session.authorization,
            "Content-Type": "application/sdp",
          },
          body: nextPeer.localDescription?.sdp ?? offer.sdp ?? "",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!whepResponse.ok) {
          throw new Error("Le relais WebRTC a refusé la lecture (HTTP " + whepResponse.status + ").");
        }
        const answer = await whepResponse.text();
        if (!answer.trim()) throw new Error("Réponse WebRTC vide.");
        const location = whepResponse.headers.get("Location");
        if (location) {
          const resolvedResource = new URL(location, session.whepUrl);
          if (resolvedResource.protocol !== "https:" ||
            resolvedResource.origin !== new URL(session.whepUrl).origin) {
            throw new Error("Le relais a retourné une ressource de lecture hors origine.");
          }
          resourceUrl = resolvedResource.toString();
        }
        await nextPeer.setRemoteDescription({ type: "answer", sdp: answer });

        const refreshSeconds = Math.min(780, Math.max(60, Number(session.refreshAfterSeconds) || 780));
        renewalTimer = window.setTimeout(async () => {
          await closeResource();
          if (!disposed) await connect();
        }, refreshSeconds * 1000);
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        await closeResource();
        setStatus("error");
        console.warn("[NAXA security] Lecture WebRTC indisponible", {
          reason: error instanceof Error ? error.message.slice(0, 180) : "unknown",
        });
      }
    };

    void connect();
    return () => {
      disposed = true;
      controller.abort();
      void closeResource();
    };
  }, [active, attempt, cameraId]);

  const statusLabel: Record<PlayerStatus, string> = {
    idle: "Direct désactivé",
    authorizing: "Autorisation en cours…",
    connecting: "Connexion au relais…",
    playing: "Direct actif",
    error: "Direct indisponible",
  };

  return (
    <div className={compact ? "space-y-2 p-2" : "space-y-3"}>
      <div className="relative overflow-hidden rounded-xl bg-slate-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls
          className="aspect-video w-full bg-slate-950 object-contain"
          aria-label="Flux vidéo sécurisé de la caméra"
        />
        {status !== "playing" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/90 px-3 text-center text-xs font-semibold text-white">
            {statusLabel[status]}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-xs text-slate-600">{statusLabel[status]}</p>
        {!active ? (
          <button
            type="button"
            onClick={() => { setActive(true); setAttempt((value) => value + 1); }}
            className="min-h-9 rounded-full bg-naxa-green-900 px-3 text-xs font-bold text-white"
          >
            Voir en direct
          </button>
        ) : status === "error" ? (
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="min-h-9 rounded-full border border-slate-300 px-3 text-xs font-bold"
          >
            Réessayer
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setActive(false); setStatus("idle"); }}
            className="min-h-9 rounded-full border border-slate-300 px-3 text-xs font-bold"
          >
            Fermer le direct
          </button>
        )}
      </div>
    </div>
  );
}
