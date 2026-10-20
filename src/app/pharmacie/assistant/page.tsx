"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Ordonnance = {
  id: string;
  document_ref: string | null;
  created_at: string;
  motif_rejet: string | null;
  client_id: string | null;
  statut: string;
};
type Preparation = {
  prescription_id: string;
  statut: "soumise" | "complement_requis" | "revue";
  notes_preparation: string | null;
  motif_complement: string | null;
  updated_at: string;
};

export default function AssistantPharmacienPage() {
  const sb = supabaseBrowser();
  const [pharmacieId, setPharmacieId] = useState<string | null>(null);
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [preparations, setPreparations] = useState<Record<string, Preparation>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const charger = useCallback(async (id: string) => {
    const [ord, prep] = await Promise.all([
      sb.from("prescriptions")
        .select("id,document_ref,created_at,motif_rejet,client_id,statut")
        .eq("pharmacie_id", id).eq("source", "client").in("statut", ["en_attente", "validee", "rejetee", "expiree"])
        .order("created_at", { ascending: true }).limit(100),
      sb.from("prescription_preparations")
        .select("prescription_id,statut,notes_preparation,motif_complement,updated_at")
        .eq("pharmacie_id", id).order("updated_at", { ascending: false }).limit(100)
    ]);
    if (ord.error || prep.error) {
      setMessage("Impossible de charger les dossiers. Vérifiez les droits et la disponibilité de la base.");
      return;
    }
    setOrdonnances((ord.data ?? []) as Ordonnance[]);
    setPreparations(Object.fromEntries(((prep.data ?? []) as Preparation[]).map(x => [x.prescription_id, x])));
  }, [sb]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { setMessage("Connexion requise."); return; }
      const { data: profil, error } = await sb.from("profiles")
        .select("fonction_interne,pharmacie_id,actif").eq("id", auth.user.id).single();
      if (cancelled) return;
      if (error || !profil?.pharmacie_id || profil.actif !== true || profil.fonction_interne !== "pharmacien_assistant") {
        setMessage("Accès réservé à un Assistant pharmacien actif, rattaché à cette pharmacie.");
        return;
      }
      setPharmacieId(profil.pharmacie_id);
      await charger(profil.pharmacie_id);
    })();
    return () => { cancelled = true; };
  }, [sb, charger]);

  async function soumettre(id: string) {
    setBusyId(id);
    const { error } = await sb.rpc("assistant_soumettre_preparation", {
      p_prescription: id,
      p_notes: notes[id] ?? ""
    });
    setBusyId(null);
    if (error) { setMessage(error.message); return; }
    setMessage("Préparation transmise au Pharmacien pour décision. Le statut pharmaceutique de l’ordonnance n’a pas été modifié.");
    if (pharmacieId) await charger(pharmacieId);
  }

  const ouvertes = ordonnances.filter(o => o.statut === "en_attente");
  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-4 pb-16">
      <header className="-mx-4 mb-5 flex items-center justify-between bg-naxa-green-900 px-4 py-3 text-white">
        <a href="/pharmacie">← Pharmacie</a><b>Espace Assistant pharmacien</b>
      </header>
      <section className="carte mb-5">
        <p className="text-xs font-extrabold uppercase tracking-widest text-naxa-green-700">Préparation des dossiers</p>
        <h1 className="mt-1 text-2xl font-extrabold text-naxa-green-900">Ordonnances à préparer</h1>
        <p className="mt-2 text-sm text-slate-600">Consultez les dossiers reçus, notez les éléments préparatoires et transmettez-les au Pharmacien. Cette page ne valide ni ne rejette une ordonnance.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">En attente</p><p className="text-2xl font-extrabold">{ouvertes.length}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Soumises</p><p className="text-2xl font-extrabold">{Object.values(preparations).filter(p => p.statut === "soumise").length}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Compléments demandés</p><p className="text-2xl font-extrabold">{Object.values(preparations).filter(p => p.statut === "complement_requis").length}</p></div>
        </div>
      </section>
      {message && <p role="status" className="carte mb-4 text-sm">{message}</p>}
      {ouvertes.length === 0 && <section className="carte"><h2 className="font-bold">Aucun dossier en attente</h2><p className="mt-1 text-sm text-slate-600">Les nouvelles ordonnances apparaîtront ici lorsqu’elles seront transmises par le client.</p></section>}
      <div className="space-y-4">
        {ouvertes.map(o => {
          const prep = preparations[o.id];
          return <article key={o.id} className="carte space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h2 className="font-extrabold">Ordonnance {o.id.slice(0, 8).toUpperCase()}</h2><p className="text-sm text-slate-600">{new Date(o.created_at).toLocaleString("fr-FR")}</p></div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">{prep?.statut === "complement_requis" ? "Complément demandé" : prep?.statut === "soumise" ? "Transmise au Pharmacien" : "À préparer"}</span>
            </div>
            <p className="text-sm">Référence document : {o.document_ref || "Non renseignée"}</p>
            {prep?.motif_complement && <p className="rounded-lg bg-amber-50 p-3 text-sm"><b>Complément demandé :</b> {prep.motif_complement}</p>}
            <label className="block text-sm font-semibold">Notes de préparation (sans diagnostic ni modification de prescription)
              <textarea className="champ mt-1 min-h-24 w-full" value={notes[o.id] ?? prep?.notes_preparation ?? ""} onChange={e => setNotes(s => ({ ...s, [o.id]: e.target.value }))} placeholder="Éléments vérifiés, pièces manquantes, point à soumettre au Pharmacien…" />
            </label>
            <button type="button" disabled={busyId === o.id} className="btn btn-vert w-full" onClick={() => soumettre(o.id)}>{busyId === o.id ? "Transmission…" : prep?.statut === "soumise" ? "Mettre à jour et retransmettre" : "Transmettre au Pharmacien"}</button>
          </article>;
        })}
      </div>
      {ordonnances.some(o => o.statut !== "en_attente") && <section className="carte mt-6">
        <h2 className="text-lg font-extrabold">Décisions et historique récent</h2>
        <div className="mt-3 space-y-3">
          {ordonnances.filter(o => o.statut !== "en_attente").map(o => <article key={o.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>Ordonnance {o.id.slice(0, 8).toUpperCase()}</b>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{o.statut === "validee" ? "Validée par le Pharmacien" : o.statut === "rejetee" ? "Rejetée" : "Expirée"}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{new Date(o.created_at).toLocaleString("fr-FR")}</p>
            {o.motif_rejet && <p className="mt-2 text-sm"><b>Motif :</b> {o.motif_rejet}</p>}
          </article>)}
        </div>
      </section>}
      <p className="mt-5 text-xs text-slate-500">Le Pharmacien conserve la décision de validation/rejet, sauf délégation explicite et vérifiée par le moteur de privilèges.</p>
    </main>
  );
}
