"use client";

import { useState } from "react";

type Period = "quotidien" | "hebdomadaire" | "mensuel" | "trimestriel" | "semestriel" | "annuel";
type Report = {
  periode_label: string;
  du: string;
  au: string;
  genere_le: string;
  indicateurs: { indicateur: string; valeur: string | number }[];
  analyse_ia: { status: string; texte: string };
  comparaison: { disponible: boolean; motif: string };
  note_periode?: string | null;
};

const periods: { value: Period; label: string }[] = [
  { value: "quotidien", label: "Quotidien" },
  { value: "hebdomadaire", label: "Hebdomadaire" },
  { value: "mensuel", label: "Mensuel" },
  { value: "trimestriel", label: "Trimestriel" },
  { value: "semestriel", label: "Semestriel" },
  { value: "annuel", label: "Annuel" },
];

type Variant = "default" | "admin" | "stock" | "pharmacien" | "comptable";

export default function RapportsALaDemande({ variant = "default" }: { variant?: Variant }) {
  const [periode, setPeriode] = useState<Period>("hebdomadaire");
  const [rapport, setRapport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState("");
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true); setError(""); setRapport(null);
    try {
      const response = await fetch("/api/rapports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periode, format: "json" }), cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Génération impossible.");
      setRapport(payload as Report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le rapport n'a pas pu être généré.");
    } finally { setBusy(false); }
  }

  async function download(format: "pdf" | "csv") {
    setExportBusy(format); setError("");
    try {
      const response = await fetch("/api/rapports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periode, format }), cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Téléchargement impossible.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `naxa-rapport-${periode}-${new Date().toISOString().slice(0,10)}.${format}`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Téléchargement impossible.");
    } finally { setExportBusy(""); }
  }

  const shellClass = variant === "admin" ? "rounded-3xl border border-[#0147BB]/15 bg-white p-5 shadow-sm" : variant === "stock" ? "rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm" : variant === "pharmacien" ? "carte space-y-4" : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
  const titleClass = variant === "admin" ? "text-[#0147BB]" : variant === "stock" ? "text-emerald-800" : "text-naxa-green-900";
  const primaryButtonClass = variant === "admin" ? "bg-[#0147BB]" : variant === "stock" ? "bg-[#0B3D26]" : "bg-naxa-green-900";
  const summaryRows = rapport?.indicateurs.filter(row => !row.indicateur.startsWith("Détail ")) ?? [];
  const pharmacyRows = rapport?.indicateurs.filter(row => row.indicateur.startsWith("Détail pharmacie ·")) ?? [];
  const promoterRows = rapport?.indicateurs.filter(row => row.indicateur.startsWith("Détail Promoteur ·")) ?? [];

  return (
    <section className={shellClass}>
      <p className={`text-xs font-extrabold uppercase tracking-widest ${titleClass}`}>Rapport à la demande · Données actualisées</p>
      <h2 className="mt-1 text-xl font-black">Générer un rapport maintenant</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Chaque génération relit les données autorisées au moment de la demande. Le rapport n'attend pas la prochaine échéance automatique. Les mêmes indicateurs alimentent l'aperçu, le PDF et le CSV.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Période
          <select value={periode} onChange={(event) => { setPeriode(event.target.value as Period); setRapport(null); }} className="mt-1 block min-h-11 rounded-xl border border-slate-300 bg-white px-3">
            {periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void generate()} disabled={busy || !!exportBusy} className={`min-h-11 rounded-xl ${primaryButtonClass} px-5 font-bold text-white disabled:opacity-60`}>{busy ? "Calcul en cours…" : "Générer maintenant"}</button>
        {rapport && <>
          <button type="button" onClick={() => void download("pdf")} disabled={!!exportBusy} className="min-h-11 rounded-xl border border-slate-300 px-5 font-bold disabled:opacity-60">{exportBusy === "pdf" ? "Préparation PDF…" : "Télécharger PDF"}</button>
          <button type="button" onClick={() => void download("csv")} disabled={!!exportBusy} className="min-h-11 rounded-xl border border-slate-300 px-5 font-bold disabled:opacity-60">{exportBusy === "csv" ? "Préparation CSV…" : "Télécharger CSV"}</button>
        </>}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {rapport && <div className="mt-5 space-y-4">
        <p role="status" className="text-xs text-slate-500">Généré le {new Date(rapport.genere_le).toLocaleString("fr-FR")} · {rapport.du} au {rapport.au}</p>
        {rapport.note_periode && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{rapport.note_periode}</p>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {summaryRows.map((row) => <article key={row.indicateur} className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{row.indicateur}</p><p className="mt-1 break-words text-lg font-black">{typeof row.valeur === "number" ? row.valeur.toLocaleString("fr-FR") : row.valeur}</p></article>)}
        </div>
        {pharmacyRows.length > 0 && <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer font-bold">Ventilation détaillée par pharmacie ({pharmacyRows.length} lignes)</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Pharmacie · indicateur</th><th className="p-2 text-right">Valeur</th></tr></thead>
              <tbody>{pharmacyRows.map(row => <tr key={row.indicateur} className="border-t border-slate-100"><td className="p-2">{row.indicateur.replace("Détail pharmacie · ", "")}</td><td className="p-2 text-right font-semibold">{typeof row.valeur === "number" ? row.valeur.toLocaleString("fr-FR") : row.valeur}</td></tr>)}</tbody>
            </table>
          </div>
        </details>}
        {promoterRows.length > 0 && <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer font-bold">Ventilation détaillée par Promoteur ({promoterRows.length} lignes)</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Promoteur · indicateur</th><th className="p-2 text-right">Valeur</th></tr></thead>
              <tbody>{promoterRows.map(row => <tr key={row.indicateur} className="border-t border-slate-100"><td className="p-2">{row.indicateur.replace("Détail Promoteur · ", "")}</td><td className="p-2 text-right font-semibold">{typeof row.valeur === "number" ? row.valeur.toLocaleString("fr-FR") : row.valeur}</td></tr>)}</tbody>
            </table>
          </div>
        </details>}
        <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-extrabold">Analyse J'IA</h3><span className="text-xs font-semibold">{rapport.analyse_ia.status}</span></div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{rapport.analyse_ia.texte}</p>
        </article>
        {!rapport.comparaison.disponible && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Comparaison historique non disponible dans le moteur actuel : {rapport.comparaison.motif}</p>}
      </div>}
    </section>
  );
}
