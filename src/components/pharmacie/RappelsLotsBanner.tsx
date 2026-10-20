"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type Alert = { id: string; motif: string; stocks_lots: { numero_lot: string; produits: { nom: string } | null } | null };

export function RappelsLotsBanner({ pharmacieId }: { pharmacieId: string | null }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    if (!pharmacieId) { setAlerts([]); setLoaded(true); return; }
    void (async () => {
      const { data, error } = await supabaseBrowser().from("rappels_lots")
        .select("id,motif,stocks_lots(numero_lot,produits(nom))")
        .eq("pharmacie_id", pharmacieId).eq("statut", "actif")
        .order("date_rappel", { ascending: false }).limit(5);
      if (active) { setAlerts(error ? [] : (data ?? []) as unknown as Alert[]); setLoaded(true); }
    })();
    return () => { active = false; };
  }, [pharmacieId]);
  if (!loaded || alerts.length === 0) return null;
  return <section role="alert" className="mb-4 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-950">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="font-extrabold">⚠ Rappel de lot actif — ne pas vendre</p><p className="mt-1 text-sm">{alerts.length} rappel(s) actif(s) pour cette pharmacie. Le POS refuse les lots bloqués.</p></div>
      <Link className="btn btn-clair" href={"/pharmacie/rappels-lots?pharmacie=" + pharmacieId}>Consulter les rappels</Link>
    </div>
    <ul className="mt-2 space-y-1 text-sm">{alerts.map((a) => <li key={a.id}>• {a.stocks_lots?.produits?.nom ?? "Produit"} · lot {a.stocks_lots?.numero_lot ?? "inconnu"} — {a.motif}</li>)}</ul>
  </section>;
}
