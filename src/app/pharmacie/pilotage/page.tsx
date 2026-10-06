"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { Barres, Liste, Section, Tuile, useTempsReel } from "@/components/Pilotage";

type Stats = {
  role: "admin" | "promoteur" | "responsable" | "pharmacie";
  pharmacies: { total: number; actives: number; inactives: number };
  recherches: { total: number; sans_resultat: number };
  entonnoir: {
    recherches: number;
    fiches_vues: number;
    paniers: number;
    reservations: number;
    ventes: number;
  };
  ca: number;
  stock: { produits_en_stock: number; ruptures: number };
  alertes: number;
  serie: { jour: string; recherches: number; reservations: number; ventes: number }[];
};

type CaisseStats = {
  role: "caisse";
  pharmacie_id: string;
  jours: number;
  evenements_reservation: number;
  paiements: number;
  retraits: number;
  annulations: number;
  ca: number;
};

export default function PilotagePharmacie() {
  const [jours, setJours] = useState(7);
  const [d, setD] = useState<Stats | CaisseStats | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();

    if (!u.user) {
      setErr("Connexion requise.");
      return;
    }

    const { data: p } = await sb.from("profiles").select("role").eq("id", u.user.id).single();
    const fn = p?.role === "caisse" ? "stats_caisse_scope" : "stats_pilotage_scope";
    const { data, error } = await sb.rpc(fn, { p_jours: jours });

    if (error) {
      setErr("Accès refusé ou données indisponibles.");
      return;
    }

    setErr("");
    setD(data as Stats | CaisseStats);
  }, [jours]);

  useTempsReel(load, (cb) => {
    const sb = supabaseBrowser();
    const c = sb
      .channel("naxa-pharmacie-pilotage")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "stocks" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "alertes" }, cb)
      .subscribe();

    return () => {
      void sb.removeChannel(c);
    };
  });

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + " %" : "—");

  if (!d) {
    return (
      <main className="min-h-screen bg-[#ACDC76] p-3 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          {err ? (
            <div role="alert" className="rounded-3xl bg-white p-4 text-red-700">
              {err}
            </div>
          ) : (
            <div className="rounded-3xl bg-white p-6">Chargement…</div>
          )}
        </div>
      </main>
    );
  }

  if (d.role === "caisse") {
    const caisse = d;

    return (
      <main className="min-h-screen bg-[#ACDC76] p-3 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-black p-4 text-white">
            <div>
              <p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Pilotage</p>
              <h1 className="text-2xl font-black text-[#D95304] sm:text-3xl">Mon activité</h1>
            </div>
            <Link href="/pharmacie" className="rounded-full border border-white px-4 py-2 text-sm">
              Espace opérationnel
            </Link>
          </header>

          <nav className="flex gap-2 overflow-x-auto">
            {[7, 30, 90].map((j) => (
              <button
                key={j}
                onClick={() => setJours(j)}
                className={`min-h-11 rounded-full px-5 text-sm font-bold ${jours === j ? "bg-[#0147BB] text-white" : "border-2 border-[#0147BB] text-[#0147BB]"}`}
              >
                {j} jours
              </button>
            ))}
          </nav>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tuile titre="Opérations réservation" valeur={caisse.evenements_reservation} />
            <Tuile titre="Paiements reçus" valeur={caisse.paiements} />
            <Tuile titre="Retraits" valeur={caisse.retraits} />
            <Tuile titre="CA traité" valeur={fcfa(caisse.ca)} />
          </div>

          <Section titre="Mon activité">
            <Liste
              vide="Aucune opération enregistrée sur la période."
              lignes={[
                { cle: "p", texte: "Paiements confirmés", valeur: String(caisse.paiements) },
                { cle: "r", texte: "Retraits confirmés", valeur: String(caisse.retraits) },
                { cle: "a", texte: "Annulations", valeur: String(caisse.annulations) },
                { cle: "ca", texte: "CA des opérations traitées", valeur: fcfa(caisse.ca) },
              ]}
            />
          </Section>

          <p className="rounded-3xl bg-white p-4 text-xs text-slate-500">
            Ce tableau ne montre pas le chiffre d’affaires des autres caisses. Il reflète uniquement les opérations attribuées à ce poste.
          </p>
        </div>
      </main>
    );
  }

  const stats = d;
  const titre =
    stats.role === "promoteur"
      ? "Pilotage Promoteur"
      : stats.role === "responsable"
        ? "Pilotage Responsable"
        : "Pilotage pharmacie";

  return (
    <main className="min-h-screen bg-[#ACDC76] p-3 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-black p-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Pilotage</p>
            <h1 className="text-2xl font-black text-[#D95304] sm:text-3xl">{titre}</h1>
          </div>
          <Link href="/pharmacie" className="rounded-full border border-white px-4 py-2 text-sm">
            Espace opérationnel
          </Link>
        </header>

        <nav className="flex gap-2 overflow-x-auto">
          {[7, 30, 90].map((j) => (
            <button
              key={j}
              onClick={() => setJours(j)}
              className={`min-h-11 rounded-full px-5 text-sm font-bold ${jours === j ? "bg-[#0147BB] text-white" : "border-2 border-[#0147BB] text-[#0147BB]"}`}
            >
              {j} jours
            </button>
          ))}
        </nav>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tuile
            titre="Pharmacies autorisées"
            valeur={stats.pharmacies.total}
            note={`${stats.pharmacies.actives} actives · ${stats.pharmacies.inactives} inactives`}
          />
          <Tuile
            titre="Recherches"
            valeur={stats.recherches.total}
            note={`${pct(stats.recherches.sans_resultat, stats.recherches.total)} sans résultat`}
          />
          <Tuile
            titre="Ventes"
            valeur={stats.entonnoir.ventes}
            note={`${stats.entonnoir.reservations} réservations`}
          />
          <Tuile
            titre="CA"
            valeur={fcfa(stats.ca)}
            note={`${stats.alertes} alerte(s) non lue(s)`}
            alerte={stats.alertes > 0}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section titre="Entonnoir">
            <Liste
              vide=""
              lignes={[
                { cle: "r", texte: "Recherches", valeur: String(stats.entonnoir.recherches) },
                {
                  cle: "f",
                  texte: "Fiches vues",
                  valeur: `${stats.entonnoir.fiches_vues} · ${pct(stats.entonnoir.fiches_vues, stats.entonnoir.recherches)}`,
                },
                {
                  cle: "p",
                  texte: "Ajouts panier",
                  valeur: `${stats.entonnoir.paniers} · ${pct(stats.entonnoir.paniers, stats.entonnoir.fiches_vues)}`,
                },
                {
                  cle: "s",
                  texte: "Réservations",
                  valeur: `${stats.entonnoir.reservations} · ${pct(stats.entonnoir.reservations, stats.entonnoir.recherches)}`,
                },
                {
                  cle: "v",
                  texte: "Ventes",
                  valeur: `${stats.entonnoir.ventes} · ${pct(stats.entonnoir.ventes, stats.entonnoir.reservations)}`,
                },
              ]}
            />
          </Section>

          <Section titre="Stock">
            <Liste
              vide=""
              lignes={[
                { cle: "ok", texte: "Produits disponibles", valeur: String(stats.stock.produits_en_stock) },
                { cle: "ko", texte: "Ruptures", valeur: String(stats.stock.ruptures) },
              ]}
            />
          </Section>
        </div>

        <Section titre="Activité des 30 derniers jours">
          <Barres
            points={stats.serie.map((x) => ({ jour: x.jour, n: x.reservations }))}
            etiquette="Réservations quotidiennes"
          />
        </Section>
      </div>
    </main>
  );
}
