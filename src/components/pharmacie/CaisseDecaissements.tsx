"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";

type Decaissement = {
  id: string;
  montant: number;
  categorie: "depense" | "remise_coffre" | "appoint" | "autre";
  motif: string;
  justificatif_ref: string | null;
  created_at: string;
  created_by: string;
};

const categories = [
  { value: "depense", label: "Dépense de caisse" },
  { value: "remise_coffre", label: "Remise au coffre" },
  { value: "appoint", label: "Appoint / transfert de fonds" },
  { value: "autre", label: "Autre sortie justifiée" },
] as const;

export function CaisseDecaissements({ sessionId }: { sessionId: string | null }) {
  const [rows, setRows] = useState<Decaissement[]>([]);
  const [montant, setMontant] = useState("");
  const [categorie, setCategorie] = useState<Decaissement["categorie"]>("depense");
  const [motif, setMotif] = useState("");
  const [justificatif, setJustificatif] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!sessionId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabaseBrowser()
      .from("caisse_decaissements")
      .select("id,montant,categorie,motif,justificatif_ref,created_at,created_by")
      .eq("caisse_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (queryError) {
      setError("Impossible de charger l’historique des décaissements. Aucune opération n’a été effectuée.");
      setRows([]);
    } else {
      setRows((data ?? []) as Decaissement[]);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  async function enregistrer() {
    if (!sessionId) {
      setError("Ouvrez votre session de caisse avant d’enregistrer une sortie.");
      return;
    }
    const amount = Number(montant);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Saisissez un montant entier strictement positif en FCFA.");
      return;
    }
    if (motif.trim().length < 5) {
      setError("Précisez un motif d’au moins 5 caractères.");
      return;
    }
    if (busy) return;
    if (!window.confirm("Enregistrer un décaissement de " + fcfa(amount) + " ? Cette sortie diminuera le solde théorique de la session et restera dans l’historique.")) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error: rpcError } = await supabaseBrowser().rpc("caisse_decaisser", {
        p_session: sessionId,
        p_montant: amount,
        p_categorie: categorie,
        p_motif: motif.trim(),
        p_justificatif_ref: justificatif.trim() || null,
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("Aucun identifiant de mouvement n’a été retourné.");
      setMontant("");
      setMotif("");
      setJustificatif("");
      setMessage("Décaissement enregistré. Référence : " + String(data).slice(0, 8).toUpperCase() + ".");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Décaissement non confirmé. Actualisez l’historique avant de réessayer.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="carte mb-4 space-y-3">
      <div>
        <h2 className="text-lg font-extrabold">Décaissements de caisse</h2>
        <p className="text-sm text-slate-600">Enregistrez toute sortie d’espèces avec son motif. Chaque mouvement est historisé et déduit du solde théorique à la clôture.</p>
      </div>
      {!sessionId ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Ouvrez une session de caisse pour enregistrer un décaissement. Le code PIN et la biométrie seront traités dans le chantier Promoteur.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Montant (FCFA)
            <input className="champ mt-1 w-full" type="number" min="1" step="1" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} disabled={busy} />
          </label>
          <label className="text-sm font-semibold">Catégorie
            <select className="champ mt-1 w-full" value={categorie} onChange={(e) => setCategorie(e.target.value as Decaissement["categorie"])} disabled={busy}>
              {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Motif obligatoire
            <textarea className="champ mt-1 w-full" minLength={5} maxLength={500} rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. achat de fournitures, remise au coffre…" disabled={busy} />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Référence du justificatif (facultatif)
            <input className="champ mt-1 w-full" maxLength={200} value={justificatif} onChange={(e) => setJustificatif(e.target.value)} placeholder="Numéro de reçu, pièce ou bordereau" disabled={busy} />
          </label>
          <div className="sm:col-span-2">
            <button type="button" className="btn btn-vert" onClick={() => void enregistrer()} disabled={busy || !sessionId}>
              {busy ? "Enregistrement…" : "Enregistrer le décaissement"}
            </button>
          </div>
        </div>
      )}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">Historique de la session</h3>
          <button type="button" className="btn btn-clair" onClick={() => void load()} disabled={loading || busy}>Actualiser</button>
        </div>
        {loading ? <p className="mt-2 text-sm text-slate-600">Chargement…</p> : rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Aucun décaissement enregistré pour cette session.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{categories.find((item) => item.value === row.categorie)?.label ?? "Décaissement"}</p>
                    <p className="text-sm text-slate-600">{row.motif}</p>
                    {row.justificatif_ref && <p className="text-xs text-slate-500">Justificatif : {row.justificatif_ref}</p>}
                    <p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                  <p className="font-extrabold text-red-700">−{fcfa(row.montant)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
