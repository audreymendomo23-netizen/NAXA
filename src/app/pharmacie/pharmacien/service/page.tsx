"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PharmacienWorkspaceShell } from "@/components/pharmacie/PharmacienWorkspaceShell";

type ServiceSession = {
  id: string;
  pharmacie_id: string;
  pharmacien_id: string;
  started_at: string;
  ended_at: string | null;
  start_note: string | null;
  end_note: string | null;
  created_at: string;
};
type Profile = { actif: boolean | null; fonction_interne: string | null; pharmacie_id: string | null };
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "En cours";
const durationLabel = (start: string, end: string | null) => {
  const elapsed = Math.max(0, (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime());
  const hours = Math.floor(elapsed / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  return hours > 0 ? `${hours} h ${minutes.toString().padStart(2, "0")} min` : `${minutes} min`;
};

export default function PharmacienServicePage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [pharmacyId, setPharmacyId] = useState("");
  const [sessions, setSessions] = useState<ServiceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [endNote, setEndNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);

  const loadSessions = useCallback(async (pid: string) => {
    const { data, error: queryError } = await sb.from("pharmacien_service_sessions")
      .select("id,pharmacie_id,pharmacien_id,started_at,ended_at,start_note,end_note,created_at")
      .eq("pharmacie_id", pid)
      .order("started_at", { ascending: false })
      .limit(100);
    if (queryError) {
      setSchemaMissing(/does not exist|schema cache|could not find the table/i.test(queryError.message));
      setError(/does not exist|schema cache|could not find the table/i.test(queryError.message)
        ? "Le module de pointage attend l’application de la migration additive 188 sur Supabase. Aucune session n’a été inventée."
        : "Les sessions de service ne sont pas accessibles. Vérifiez les droits RLS et réessayez.");
      return false;
    }
    setSchemaMissing(false);
    setSessions((data ?? []) as ServiceSession[]);
    setError("");
    return true;
  }, [sb]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: auth, error: authError } = await sb.auth.getUser();
    if (authError || !auth.user) {
      setError("Connexion requise pour accéder à Prise / fin de service.");
      setLoading(false);
      return;
    }
    const { data: profile, error: profileError } = await sb.from("profiles")
      .select("actif,fonction_interne,pharmacie_id").eq("id", auth.user.id).maybeSingle();
    const p = profile as Profile | null;
    if (profileError || !p || p.actif !== true || p.fonction_interne !== "pharmacien" || !p.pharmacie_id) {
      setError("Accès réservé à un compte Pharmacien actif rattaché à une pharmacie.");
      setLoading(false);
      return;
    }
    const { data: pharmacy, error: pharmacyError } = await sb.from("pharmacies")
      .select("id,actif").eq("id", p.pharmacie_id).maybeSingle();
    if (pharmacyError || !pharmacy || pharmacy.actif !== true) {
      setError("La pharmacie est inactive ; le pointage est bloqué.");
      setLoading(false);
      return;
    }
    setPharmacyId(p.pharmacie_id);
    await loadSessions(p.pharmacie_id);
    setLoading(false);
  }, [sb, loadSessions]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openSession = sessions.find(session => !session.ended_at) ?? null;
  async function startService() {
    if (busy || !pharmacyId || openSession) return;
    setBusy(true); setError(""); setMessage("");
    const { error: rpcError } = await sb.rpc("pharmacien_service_demarrer", { p_note: note.trim() || null });
    setBusy(false);
    if (rpcError) { setError(rpcError.message || "Impossible de démarrer le service."); return; }
    setNote("");
    setMessage("Prise de service enregistrée côté serveur.");
    await loadSessions(pharmacyId);
  }
  async function endService() {
    if (busy || !openSession) return;
    setBusy(true); setError(""); setMessage("");
    const { error: rpcError } = await sb.rpc("pharmacien_service_terminer", {
      p_session: openSession.id,
      p_note: endNote.trim() || null,
    });
    setBusy(false);
    if (rpcError) { setError(rpcError.message || "Impossible de terminer le service."); return; }
    setEndNote("");
    setMessage("Fin de service enregistrée côté serveur.");
    await loadSessions(pharmacyId);
  }

  return <PharmacienWorkspaceShell activeTab="profil" onNavigate={(section) => {
    if (section === "dashboard") window.location.href = "/pharmacie/pharmacien";
    else if (section === "dispositifs") window.location.href = "/pharmacie/pharmacien/suivi-patients";
    else window.location.href = `/pharmacie/pharmacien/${section}`;
  }}>
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] px-4 py-4 text-white">
      <div><Link className="text-sm text-emerald-100 hover:text-white" href="/pharmacie/pharmacien">← Espace Pharmacien</Link><h1 className="mt-1 text-2xl font-black">Prise / fin de service</h1><p className="mt-1 text-sm text-emerald-100">Pointage personnel horodaté, séparé des sessions de caisse.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="min-h-10 rounded-xl border border-white/30 px-4 py-2 text-sm font-bold disabled:opacity-50">Actualiser</button>
    </header>
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>{schemaMissing ? "Module en attente de migration" : "Action impossible"}</b><p className="mt-1">{error}</p></div>}
    {loading ? <section className="carte" aria-live="polite">Chargement des sessions de service…</section> : !error || schemaMissing ? <>
      <section className="carte space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold">État du service</h2><p className="text-sm text-slate-600">Les heures sont générées par le serveur pour éviter les pointages falsifiés depuis le navigateur.</p></div><span className={`rounded-full px-3 py-1 text-sm font-bold ${openSession ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{openSession ? "Service ouvert" : "Aucun service ouvert"}</span></div>
        {openSession ? <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-sm text-slate-600">Prise de service</p><p className="font-bold">{dateLabel(openSession.started_at)}</p></div><div><p className="text-sm text-slate-600">Durée en cours</p><p className="font-bold">{durationLabel(openSession.started_at, null)}</p></div></div><label className="block text-sm font-semibold">Note de fin de service (facultative)<textarea className="champ mt-1 min-h-20 w-full" maxLength={1000} value={endNote} onChange={e => setEndNote(e.target.value)} placeholder="Transmission, point à signaler à l’équipe…"/></label><button type="button" disabled={busy} onClick={() => void endService()} className="btn btn-vert w-full disabled:opacity-50">{busy ? "Enregistrement…" : "Terminer mon service"}</button></div> : <div className="space-y-3 rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-600">Démarrez votre service au début de votre prise de poste. Une seule session ouverte est autorisée par compte.</p><label className="block text-sm font-semibold">Note de prise de service (facultative)<textarea className="champ mt-1 min-h-20 w-full" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Transmission reçue, poste ou observation…"/></label><button type="button" disabled={busy || schemaMissing} onClick={() => void startService()} className="btn btn-vert w-full disabled:opacity-50">{busy ? "Enregistrement…" : "Prendre mon service"}</button></div>}
      </section>
      <section className="carte space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold">Historique des pointages</h2><span className="text-sm text-slate-500">{sessions.length} session(s) affichée(s)</span></div>
        {sessions.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Aucun pointage enregistré pour ce compte.</p> : <div className="space-y-3">{sessions.map(session => <article key={session.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><b>{session.ended_at ? "Service terminé" : "Service en cours"}</b><p className="mt-1 text-sm text-slate-600">Début : {dateLabel(session.started_at)}</p><p className="text-sm text-slate-600">Fin : {dateLabel(session.ended_at)}</p></div><span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold">{durationLabel(session.started_at, session.ended_at)}</span></div>{session.start_note && <p className="mt-3 text-sm"><b>Note de prise :</b> {session.start_note}</p>}{session.end_note && <p className="mt-1 text-sm"><b>Note de fin :</b> {session.end_note}</p>}</article>)}</div>}
      </section>
      <p className="px-1 text-xs text-slate-500">Les pointages sont distincts des heures planifiées : la planification des horaires et les rapports de présence par équipe nécessitent un module de planning séparé.</p>
    </> : null}
  </PharmacienWorkspaceShell>;
}
