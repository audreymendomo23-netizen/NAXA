"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type AccountantAccess = {
  pharmacie_id: string;
  pharmacie_nom: string;
  comptable_id: string;
  nom: string | null;
  username: string | null;
  compte_actif: boolean;
  ecriture_autorisee: boolean;
};

export function ComptaDroitsManager({ rows }: { rows: AccountantAccess[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const grouped = useMemo(() => {
    const map = new Map<string, AccountantAccess[]>();
    for (const row of rows) map.set(row.pharmacie_id, [...(map.get(row.pharmacie_id) ?? []), row]);
    return [...map.entries()];
  }, [rows]);

  async function setAccess(row: AccountantAccess, autorise: boolean) {
    const key = row.pharmacie_id + ":" + row.comptable_id;
    setBusy(key); setError(""); setMessage("");
    try {
      const { data, error: rpcError } = await supabaseBrowser().rpc("compta_promoteur_configurer_ecriture", {
        p_pharmacie: row.pharmacie_id,
        p_comptable: row.comptable_id,
        p_autorise: autorise,
      });
      if (rpcError) throw rpcError;
      const confirmation = data as { ecriture_autorisee?: boolean; lecture_conservee?: boolean } | null;
      if (!confirmation || confirmation.ecriture_autorisee !== autorise || confirmation.lecture_conservee !== true) {
        throw new Error("La base n’a pas confirmé le changement de droit.");
      }
      setMessage(autorise
        ? `Droit d’écriture partagé avec ${row.nom || row.username || "le Comptable"} pour ${row.pharmacie_nom}.`
        : `Droit d’écriture retiré. Le Comptable conserve la lecture pour ${row.pharmacie_nom}.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modification du droit impossible.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="space-y-5">
    <header className="rounded-2xl border border-emerald-100 bg-white p-5">
      <h2 className="text-lg font-extrabold">Droits comptables du réseau</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Le Promoteur conserve toujours le pouvoir de configuration et de validation. Il peut partager ou retirer séparément le droit d’écriture de chaque Comptable affecté à une pharmacie.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold uppercase text-emerald-900">Partager le droit en écriture</p><p className="mt-1 text-sm text-emerald-950">Autorise le Comptable à configurer et valider.</p></div>
        <div className="rounded-xl bg-sky-50 p-3"><p className="text-xs font-bold uppercase text-sky-900">Valider plan comptable</p><p className="mt-1 text-sm text-sky-950">Le Promoteur conserve cette autorité en permanence.</p></div>
        <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-bold uppercase text-slate-800">Lecture seulement</p><p className="mt-1 text-sm text-slate-700">Retire l’écriture du Comptable sans retirer son accès aux données.</p></div>
      </div>
    </header>
    {grouped.length === 0 ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Aucun Comptable actif n’est actuellement affecté aux pharmacies de votre réseau.</p> : grouped.map(([pharmacieId, people]) => (
      <section key={pharmacieId} className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="font-extrabold">{people[0].pharmacie_nom}</h3>
        <ul className="mt-3 divide-y divide-slate-100">
          {people.map(row => {
            const key = row.pharmacie_id + ":" + row.comptable_id;
            const isBusy = busy === key;
            return <li key={row.comptable_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold">{row.nom || row.username || "Comptable"}</p><p className="text-xs text-slate-500">{row.username ? `@${row.username} · ` : ""}{row.compte_actif ? "Compte actif" : "Compte inactif"}</p><p className="mt-1 text-sm">{row.ecriture_autorisee ? <span className="font-semibold text-emerald-800">Écriture autorisée</span> : <span className="font-semibold text-slate-600">Lecture seulement</span>}</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={isBusy || !row.compte_actif || row.ecriture_autorisee} onClick={() => void setAccess(row, true)} className="min-h-10 rounded-full bg-naxa-green-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isBusy ? "Enregistrement…" : "Partager le droit en écriture"}</button>
                <button type="button" disabled={isBusy || !row.ecriture_autorisee} onClick={() => void setAccess(row, false)} className="min-h-10 rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-50">Lecture seulement</button>
              </div>
            </li>;
          })}
        </ul>
      </section>
    ))}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  </div>;
}
