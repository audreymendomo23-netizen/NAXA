"use client";

import { useCallback, useEffect, useState } from "react";

type Segment = {
  id: string;
  pharmacyId: string;
  cameraId: string;
  status: "ready" | "protected";
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  codec: string;
  containerFormat: string;
  sizeBytes: number;
  sha256: string;
  protectedAt: string | null;
  protectedReason: string | null;
};

function formatBytes(bytes: number): string {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return "Taille indisponible";
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + " Go";
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + " Mo";
  return Math.round(bytes / 1024) + " Ko";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Africa/Douala", dateStyle: "medium", timeStyle: "medium",
    }).format(date)
    : "Date inconnue";
}

export function SecurityRecordingTimeline({ pharmacyId }: { pharmacyId: string | null }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (pharmacyId) params.set("pharmacieId", pharmacyId);
      params.set("from", new Date(from + "T00:00:00+01:00").toISOString());
      params.set("to", new Date(to + "T23:59:59+01:00").toISOString());
      const response = await fetch("/api/security/recording-segments?" + params.toString(), {
        method: "GET", cache: "no-store", credentials: "same-origin",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true || !Array.isArray(result.segments)) {
        throw new Error(typeof result.error === "string" ? result.error : "Lecture de la timeline refusée.");
      }
      setSegments(result.segments as Segment[]);
      if (result.truncated) setNotice("Affichage limité aux 100 archives les plus récentes. Réduisez la période pour affiner.");
      else setNotice("");
    } catch (cause) {
      setSegments([]);
      setError(cause instanceof Error ? cause.message : "Timeline indisponible.");
    } finally {
      setLoading(false);
    }
  }, [pharmacyId, from, to]);

  useEffect(() => { void load(); }, [load]);

  async function toggleProtection(segment: Segment) {
    if (reason.trim().length < 8 || reason.trim().length > 500) {
      setError("La justification doit contenir entre 8 et 500 caractères.");
      return;
    }
    setBusyId(segment.id);
    setError("");
    try {
      const response = await fetch("/api/security/recording-segments/protection", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId: segment.id, protect: segment.status !== "protected", reason: reason.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || "Mise à jour refusée.");
      setReason("");
      await load();
      setNotice(segment.status === "protected" ? "Protection retirée ; l'archive redevient soumise à la rétention après synchronisation de la passerelle." : "Archive protégée et auditée ; la passerelle appliquera cette protection lors de sa prochaine synchronisation sécurisée.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Protection indisponible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Timeline des enregistrements locaux">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold">Archives locales · timeline</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Métadonnées des segments confirmés par les passerelles. Les vidéos restent sur le stockage local ; aucune URL ou chemin interne n'est exposé.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{segments.length} archive(s)</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-xs font-bold text-slate-700">
          Du
          <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)}
            className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal" />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Au
          <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)}
            className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal" />
        </label>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="min-h-10 rounded-full border border-slate-300 px-4 text-sm font-bold disabled:opacity-50">
          Actualiser
        </button>
      </div>

      <label className="mt-3 block text-xs font-bold text-slate-700">
        Justification de protection ou de libération (8 à 500 caractères)
        <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500}
          placeholder="Ex. conservation liée à un incident déclaré"
          className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal" />
      </label>

      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-slate-600">Chargement des archives…</p>
      ) : segments.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Aucune archive locale indexée sur la période choisie. Cela ne signifie pas qu'une caméra est absente.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {segments.map((segment) => (
            <li key={segment.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{formatDate(segment.startedAt)}</p>
                  <p className="mt-1 text-xs text-slate-600">{Math.round(segment.durationSeconds)} s · {segment.codec} · {formatBytes(segment.sizeBytes)}</p>
                  <p className="mt-1 break-all font-mono text-[10px] text-slate-500">SHA-256 : {segment.sha256}</p>
                </div>
                <span className={"rounded-full px-2.5 py-1 text-xs font-bold " + (segment.status === "protected" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700")}>
                  {segment.status === "protected" ? "Protégée" : "Rétention normale"}
                </span>
              </div>
              {segment.protectedReason && <p className="mt-2 text-xs text-slate-600">Motif : {segment.protectedReason}</p>}
              <button type="button" onClick={() => void toggleProtection(segment)} disabled={busyId === segment.id || reason.trim().length < 8}
                className="mt-3 min-h-9 rounded-full border border-slate-300 px-3 text-xs font-bold disabled:opacity-50">
                {busyId === segment.id ? "Enregistrement…" : segment.status === "protected" ? "Retirer la protection" : "Protéger cette archive"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
        La protection serveur est enregistrée et auditée immédiatement. La passerelle l'applique à sa rétention lorsqu'elle confirme sa synchronisation ; si elle ne peut pas confirmer l'état complet, elle suspend toute purge. La relecture et l'export vidéo ne sont pas activés dans cette étape.
      </p>
    </section>
  );
}
