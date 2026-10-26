"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { exporterCsv } from "@/components/Pilotage";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";

type RapportEnregistre = { id: string; periode: string; du: string; au: string; texte: string; pharmacie_nom?: string | null };
type Instantane = { pharmacies: number; pharmacies_actives: number; promoteurs: number; produits_en_stock: number; recherches: number; recherches_sans_resultat: number; reservations: number; ventes: number; revenus_fcfa: number; ruptures: number; alertes: number; taux_conversion_vente: number };

export default function Reports() {
  const [data, setData] = useState<RapportEnregistre[]>([]);
  const [err, setErr] = useState("");
  const [jours, setJours] = useState(7);
  const [instantane, setInstantane] = useState<Instantane | null>(null);
  const [dateGeneration, setDateGeneration] = useState("");
  const [generation, setGeneration] = useState(false);
  const [format, setFormat] = useState<"csv" | "json" | "pdf">("csv");

  useEffect(() => {
    let actif = true;
    void (async () => {
      try {
        const response = await fetch("/api/rapports");
        const json = await response.json();
        if (!actif) return;
        if (!response.ok) { setErr(json.error || "Impossible de charger les rapports enregistrés."); return; }
        setData(json.rapports || []);
      } catch {
        if (actif) setErr("Impossible de joindre le service des rapports. Vérifiez la connexion puis réessayez.");
      }
    })();
    return () => { actif = false; };
  }, []);

  async function genererInstantane() {
    setGeneration(true);
    setErr("");
    try {
      const response = await fetch("/api/rapports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jours }),
      });
      const json = await response.json();
      if (!response.ok) {
        setErr(json.error || "Le rapport n’a pas pu être généré et enregistré.");
        return;
      }
      const row = json.instantane as Instantane | undefined;
      if (!row || !["pharmacies", "pharmacies_actives", "promoteurs", "produits_en_stock", "recherches", "recherches_sans_resultat", "reservations", "ventes", "revenus_fcfa", "ruptures", "alertes", "taux_conversion_vente"].every((key) => typeof row[key as keyof Instantane] === "number")) {
        setErr("Le serveur n’a pas renvoyé un rapport exploitable.");
        return;
      }
      setInstantane(row);
      setDateGeneration(new Date(json.genere_le || Date.now()).toLocaleString("fr-FR"));
      const historyResponse = await fetch("/api/rapports");
      const historyJson = await historyResponse.json();
      if (historyResponse.ok) setData(historyJson.rapports || []);
      setErr("");
    } catch {
      setErr("La génération ou l’enregistrement du rapport a échoué. Vérifiez la connexion puis réessayez.");
    } finally {
      setGeneration(false);
    }
  }

  function lignesInstantane() {
    if (!instantane) return [];
    return [
      { indicateur: "Période", valeur: `${jours} derniers jours` },
      { indicateur: "Généré le", valeur: dateGeneration },
      { indicateur: "Pharmacies", valeur: instantane.pharmacies },
      { indicateur: "Pharmacies actives", valeur: instantane.pharmacies_actives },
      { indicateur: "Promoteurs actifs", valeur: instantane.promoteurs },
      { indicateur: "Produits en stock", valeur: instantane.produits_en_stock },
      { indicateur: "Recherches", valeur: instantane.recherches },
      { indicateur: "Recherches sans résultat", valeur: instantane.recherches_sans_resultat },
      { indicateur: "Réservations", valeur: instantane.reservations },
      { indicateur: "Ventes", valeur: instantane.ventes },
      { indicateur: "Revenus (FCFA)", valeur: instantane.revenus_fcfa },
      { indicateur: "Ruptures de stock", valeur: instantane.ruptures },
      { indicateur: "Alertes non lues", valeur: instantane.alertes },
      { indicateur: "Taux de conversion vente (%)", valeur: instantane.taux_conversion_vente },
    ];
  }

  function exporterInstantane() {
    if (!instantane) return;
    const rows = lignesInstantane();
    if (format === "csv") {
      exporterCsv(`rapport-pilotage-${jours}-jours`, rows);
      return;
    }
    if (format === "json") {
      const blob = new Blob([JSON.stringify({ titre: "Rapport de pilotage NAXA", periode_jours: jours, genere_le: dateGeneration, indicateurs: rows }, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rapport-pilotage-${jours}-jours.json`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    window.print();
  }

  async function partagerInstantane() {
    if (!instantane) return;
    const texte = ["Rapport de pilotage NAXA", `Période : ${jours} derniers jours`, `Généré le : ${dateGeneration}`, ...lignesInstantane().slice(2).map((row) => `${row.indicateur} : ${row.valeur}`)].join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "Rapport de pilotage NAXA", text: texte });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texte);
        setErr("Rapport copié dans le presse-papiers : vous pouvez maintenant le partager.");
      } else setErr("Le partage n’est pas disponible sur cet appareil.");
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError")) setErr("Le partage du rapport a échoué. Réessayez.");
    }
  }

  return <main className="admin-analytics-page admin-reports-page min-h-screen bg-[#ACDC76] p-3 sm:p-6">
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-black p-4 text-white print:bg-white print:text-black">
        <div><p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Rapports réseau</p><h1 className="text-2xl font-black text-[#D95304]">Rapports & Analytics</h1></div>
        <Link href="/admin/pilotage" className="rounded-full border border-white px-4 py-2">Retour au pilotage</Link>
      </header>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Rapport à la demande</p>
        <h2 className="mt-1 text-xl font-black">Créer un instantané du réseau</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Calcule et enregistre un rapport réseau sur la période choisie. Consultez ensuite l’historique ci-dessous ; le rapport courant peut être téléchargé en CSV ou JSON, ou imprimé pour l’enregistrer en PDF.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="text-sm font-semibold">Période
            <select value={jours} onChange={(event) => setJours(Number(event.target.value))} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 sm:w-52">
              <option value={7}>7 derniers jours</option><option value={30}>30 derniers jours</option><option value={90}>90 derniers jours</option>
            </select>
          </label>
          <button type="button" onClick={() => void genererInstantane()} disabled={generation} className="min-h-11 rounded-xl bg-[#0147BB] px-5 font-bold text-white disabled:opacity-60">{generation ? "Génération en cours…" : "Générer le rapport"}</button>
          {instantane && <>
            <label className="text-sm font-semibold">Format du rapport
              <select value={format} onChange={(event) => setFormat(event.target.value as "csv" | "json" | "pdf")} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
                <option value="csv">CSV (tableur)</option><option value="json">JSON (données)</option><option value="pdf">PDF (impression)</option>
              </select>
            </label>
            <button type="button" onClick={exporterInstantane} className="min-h-11 rounded-xl border border-slate-300 px-5 font-bold text-slate-800">{format === "pdf" ? "Télécharger / imprimer PDF" : `Télécharger ${format.toUpperCase()}`}</button>
            <button type="button" onClick={() => void partagerInstantane()} className="min-h-11 rounded-xl border border-slate-300 px-5 font-bold text-slate-800">Partager</button>
          </>}
        </div>
        {err && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{err}</p>}
        {instantane && <div className="mt-5 space-y-4">
          <p role="status" className="text-xs text-slate-500">Rapport généré le {dateGeneration} · période de {jours} jours</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Pharmacies", instantane.pharmacies],
              ["Pharmacies actives", instantane.pharmacies_actives],
              ["Promoteurs actifs", instantane.promoteurs],
              ["Produits en stock", instantane.produits_en_stock],
              ["Recherches", instantane.recherches],
              ["Réservations", instantane.reservations],
              ["Ventes", instantane.ventes],
              ["Revenus", fcfa(instantane.revenus_fcfa)],
            ].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-xl font-black">{value}</p></article>)}
          </div>
        </div>}
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-lg font-black text-slate-950">Historique des rapports enregistrés</h2>
        {!err && data.length === 0 && <div className="rounded-3xl bg-white p-5"><p className="font-extrabold">Aucun rapport enregistré</p><p className="mt-2 text-sm leading-6 text-slate-600">Les rapports générés sont enregistrés ici. Créez un instantané avec le bouton ci-dessus pour alimenter cet historique.</p></div>}
        {data.map((report) => <article key={report.id} className="admin-report-card rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-extrabold">{report.periode} · {report.pharmacie_nom || "NAXA"}</h3><p className="text-xs text-slate-500">{report.du} → {report.au}</p></div><button type="button" className="rounded-full border px-4 py-2 text-sm font-bold" onClick={() => exporterCsv("rapport-" + report.id, [{ periode: report.periode, du: report.du, au: report.au, texte: report.texte }])}>CSV</button></div>
          <p className="mt-3 text-sm leading-6">{report.texte}</p>
        </article>)}
      </section>
    </div>
  </main>;
}
