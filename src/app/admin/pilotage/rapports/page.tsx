"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RapportsALaDemande from "@/components/RapportsALaDemande";

type SavedReport = { id: string; periode: string; du: string; au: string; texte: string; pharmacie_nom?: string | null };

export default function Reports() {
  const [data, setData] = useState<SavedReport[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/rapports", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!active) return;
      if (!response.ok) setError(payload.error || "Historique indisponible.");
      else setData(payload.rapports || []);
    }).catch(() => { if (active) setError("Impossible de charger l'historique."); });
    return () => { active = false; };
  }, []);

  return <main className="admin-analytics-page admin-reports-page min-h-screen bg-[#ACDC76] p-3 sm:p-6">
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-black p-4 text-white">
        <div><p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Rapports réseau</p><h1 className="text-2xl font-black text-[#D95304]">Rapports & Analytics</h1></div>
        <Link href="/admin/pilotage" className="rounded-full border border-white px-4 py-2">Retour au pilotage</Link>
      </header>
      <RapportsALaDemande />
      <section className="space-y-3">
        <h2 className="px-1 text-lg font-black text-slate-950">Historique des rapports automatiques enregistrés</h2>
        {error && <p role="alert" className="rounded-2xl bg-white p-4 text-sm text-red-800">{error}</p>}
        {!error && data.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">Aucun rapport automatique enregistré pour le moment. Les rapports à la demande sont générés sans attendre cette planification.</p>}
        {data.map((report) => <article key={report.id} className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="font-extrabold">{report.periode} · {report.pharmacie_nom || "NAXA"}</h3>
          <p className="text-xs text-slate-500">{report.du} → {report.au}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{report.texte}</p>
        </article>)}
      </section>
    </div>
  </main>;
}
