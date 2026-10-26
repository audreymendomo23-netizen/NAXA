"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { Barres, Liste, Section, Tuile, useTempsReel } from "@/components/Pilotage";

type PilotageData = {
  pharmacies: { actives: number; inactives: number; total?: number };
  recherches: { total: number; sans_resultat: number };
  entonnoir: {
    recherches: number;
    fiches_vues: number;
    paniers: number;
    reservations: number;
    ventes: number;
  };
  ca: number;
  alertes: number;
  stock: { produits_en_stock: number; ruptures: number };
  serie: { jour: string; reservations: number }[];
};

export default function Page() {
  const [jours, setJours] = useState(7);
  const [d, setD] = useState<PilotageData | null>(null);
  const [err, setErr] = useState("");
  const [chargement, setChargement] = useState(true);

  const load = useCallback(async () => {
    setChargement(true);
    try {
      const sb = supabaseBrowser();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        sb.rpc("stats_pilotage_scope", { p_jours: jours }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("PILOTAGE_TIMEOUT")), 12000);
        }),
      ]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      const { data, error } = result;

      if (error) {
        setErr(
          error.code === "PGRST202" || error.code === "42883"
            ? "Le service de statistiques est indisponible. La fonction Supabase attendue n’est pas accessible."
            : error.code === "42501" || error.message.toLowerCase().includes("accès")
              ? "Accès refusé : vérifie que ton compte possède toujours le rôle administrateur actif."
              : "Impossible de charger les statistiques. Réessaie ; si le problème persiste, l’accès Supabase doit être vérifié."
        );
        return;
      }

      if (!data || typeof data !== "object" || !("entonnoir" in data) || !("pharmacies" in data)) {
        setErr("Le service de statistiques a répondu sans données exploitables.");
        return;
      }

      setD(data as PilotageData);
      setErr("");
    } catch (cause) {
      setErr(
        cause instanceof Error && cause.message === "PILOTAGE_TIMEOUT"
          ? "Le service de statistiques ne répond pas après 12 secondes. Vérifie la fonction Supabase stats_pilotage_scope et réessaie."
          : "La connexion au service de statistiques a échoué. Vérifie ta connexion puis réessaie."
      );
    } finally {
      setChargement(false);
    }
  }, [jours]);

  const premierePeriode = useRef(true);
  useEffect(() => {
    if (premierePeriode.current) {
      premierePeriode.current = false;
      return;
    }
    void load();
  }, [jours, load]);

  useTempsReel(load, (cb) => {
    const sb = supabaseBrowser();
    const channel = sb
      .channel("naxa-admin-pilotage")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "stocks" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "alertes" }, cb)
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  });

  const e = d?.entonnoir;
  const pct = (a: number, b: number) => b ? Math.round(a / b * 100) + " %" : "—";

  return (
    <main className="admin-analytics-page min-h-screen bg-[#ACDC76] p-3 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-black p-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Pilotage réseau</p>
            <h1 className="text-2xl font-black text-[#D95304] sm:text-3xl">Aujourd’hui</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-full border border-white px-4 py-2 text-sm" href="/admin">Espace NAXA</Link>
            <Link className="rounded-full bg-[#FAD405] px-4 py-2 text-sm font-bold text-black" href="/admin/pilotage/validite">Validité pharmacies</Link>
          </div>
        </header>

        <nav aria-label="Période des statistiques" className="flex gap-2 overflow-x-auto">
          {[7, 30, 90].map((j) => (
            <button
              key={j}
              type="button"
              aria-pressed={jours === j}
              onClick={() => setJours(j)}
              className={`min-h-11 rounded-full px-5 py-2 text-sm font-bold ${jours === j ? "bg-[#0147BB] text-white" : "border-2 border-[#0147BB] text-[#0147BB]"}`}
            >
              {j} jours
            </button>
          ))}
        </nav>

        {err && (
          <div role="alert" className="rounded-3xl bg-white p-4 text-red-700">
            <p>{err}</p>
            <button type="button" onClick={() => void load()} className="mt-3 min-h-10 rounded-full bg-[#0147BB] px-4 font-bold text-white">
              Réessayer
            </button>
          </div>
        )}
        {chargement && !d && !err && <div role="status" className="rounded-3xl bg-white p-6">Chargement des statistiques…</div>}

        {d && e && (
          <>
            {chargement && <p role="status" className="text-sm text-slate-700">Actualisation des données…</p>}
            <div className="admin-analytics-kpis grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tuile titre="Pharmacies actives" valeur={d.pharmacies.actives} note={`${d.pharmacies.inactives} inactives`} alerte={d.pharmacies.inactives > 0} />
              <Tuile titre="Recherches" valeur={d.recherches.total} note={`${pct(d.recherches.sans_resultat, d.recherches.total)} sans résultat`} alerte={d.recherches.sans_resultat > 0} />
              <Tuile titre="Ventes" valeur={e.ventes} note={`${e.reservations} réservations`} />
              <Tuile titre="CA" valeur={fcfa(d.ca)} note={`${d.alertes} alerte(s) non lue(s)`} alerte={d.alertes > 0} />
            </div>
            <div className="admin-analytics-panels grid gap-4 lg:grid-cols-2">
              <Section titre="Entonnoir commercial">
                <Liste vide="Aucune donnée pour cette période." lignes={[
                  { cle: "r", texte: "Recherches", valeur: String(e.recherches) },
                  { cle: "f", texte: "Fiches vues", valeur: `${e.fiches_vues} · ${pct(e.fiches_vues, e.recherches)}` },
                  { cle: "p", texte: "Ajouts panier", valeur: `${e.paniers} · ${pct(e.paniers, e.fiches_vues)}` },
                  { cle: "s", texte: "Réservations", valeur: `${e.reservations} · ${pct(e.reservations, e.recherches)}` },
                  { cle: "v", texte: "Ventes", valeur: `${e.ventes} · ${pct(e.ventes, e.reservations)}` },
                ]} />
              </Section>
              <Section titre="Stock réseau">
                <Liste vide="Aucune donnée de stock disponible." lignes={[
                  { cle: "ok", texte: "Produits disponibles", valeur: String(d.stock.produits_en_stock) },
                  { cle: "ko", texte: "Ruptures", valeur: String(d.stock.ruptures) },
                ]} />
              </Section>
            </div>
            <Section titre="Activité quotidienne">
              <Barres points={d.serie.map((x) => ({ jour: x.jour, n: x.reservations }))} etiquette="Réservations quotidiennes" />
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
