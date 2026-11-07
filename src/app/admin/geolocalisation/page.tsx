"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type EtatGeo = {
  ok: boolean;
  derniereSynchronisation?: string | null;
  candidatsAConfirmer?: number;
  pharmaciesPartenairesSansCoordonnees?: number;
  dernierResultat?: { candidatsImportes?: number; pharmaciesRapprochees?: number; erreur?: string | null } | null;
  attribution?: string;
  error?: string;
  skipped?: boolean;
  message?: string;
  candidatsImportes?: number;
  pharmaciesPartenairesRapprochees?: number;
  pharmaciesAvecCoordonneesPreservees?: number;
  pharmaciesSansCorrespondanceExacte?: number;
  prochainesSynchronisationsApres?: string;
  avertissement?: string;
};

const dateLisible = (value?: string | null) => value
  ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Jamais";

export default function GeolocalisationAdminPage() {
  const [etat, setEtat] = useState<EtatGeo | null>(null);
  const [resultat, setResultat] = useState<EtatGeo | null>(null);
  const [chargement, setChargement] = useState(true);
  const [synchronisation, setSynchronisation] = useState(false);
  const [erreur, setErreur] = useState("");

  const actualiser = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const response = await fetch("/api/admin/geolocalisation-osm", { cache: "no-store" });
      const data = await response.json() as EtatGeo;
      if (!response.ok || !data.ok) throw new Error(data.error || "État de géolocalisation indisponible.");
      setEtat(data);
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Impossible de lire l'état OSM.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { void actualiser(); }, [actualiser]);

  const synchroniser = async () => {
    setSynchronisation(true);
    setErreur("");
    setResultat(null);
    try {
      const response = await fetch("/api/admin/geolocalisation-osm", { method: "POST" });
      const data = await response.json() as EtatGeo;
      if (!response.ok || !data.ok) throw new Error(data.error || "La synchronisation OSM a échoué.");
      setResultat(data);
      await actualiser();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "La synchronisation OSM a échoué.");
    } finally {
      setSynchronisation(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#F4F8F5] px-4 py-6 text-[#0B3D26] sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F6B3F] hover:underline">
          <span aria-hidden="true">←</span> Retour à l’administration
        </Link>

        <header className="rounded-3xl bg-[#0F6B3F] p-6 text-white shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FFE23D]">Référentiel cartographique</p>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Géolocalisation des pharmacies</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Récupérez les candidats d’annuaire cartographiés dans les dix régions du Cameroun. Les noms et les villes exacts peuvent aider à compléter les coordonnées manquantes des partenaires existants, sans modifier les positions déjà renseignées.
          </p>
          <button type="button" onClick={synchroniser} disabled={synchronisation || chargement}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#FFE23D] px-5 py-3 text-sm font-extrabold text-[#0B3D26] disabled:cursor-not-allowed disabled:opacity-60">
            {synchronisation ? "Synchronisation en cours…" : "Synchroniser OpenStreetMap"}
          </button>
          <p className="mt-3 text-xs leading-5 text-white/75">
            Action réservée à l’administrateur. Une synchronisation maximum toutes les 24 heures.
          </p>
        </header>

        {erreur && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erreur}</div>}

        {resultat && (
          <section aria-live="polite" className="rounded-3xl border border-[#D7E7DB] bg-white p-5 shadow-sm">
            <h2 className="font-bold">Résultat de la synchronisation</h2>
            {resultat.skipped ? <p className="mt-2 text-sm">{resultat.message}</p> : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Candidats importés" value={resultat.candidatsImportes ?? 0} />
                  <Metric label="Partenaires rapprochés" value={resultat.pharmaciesPartenairesRapprochees ?? 0} />
                  <Metric label="Positions préservées" value={resultat.pharmaciesAvecCoordonneesPreservees ?? 0} />
                  <Metric label="Sans correspondance" value={resultat.pharmaciesSansCorrespondanceExacte ?? 0} />
                </div>
                {resultat.avertissement && <p className="mt-4 text-sm leading-6 text-[#5C6F62]">{resultat.avertissement}</p>}
              </>
            )}
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Candidats à confirmer" value={chargement ? "…" : etat?.candidatsAConfirmer ?? "—"} detail="Référentiel public, hors partenaires" />
          <MetricCard label="Partenaires sans GPS" value={chargement ? "…" : etat?.pharmaciesPartenairesSansCoordonnees ?? "—"} detail="Toutes les régions du Cameroun" />
          <MetricCard label="Dernière synchronisation" value={chargement ? "…" : dateLisible(etat?.derniereSynchronisation)} detail="Heure locale de l’appareil" />
        </section>

        <section className="rounded-3xl border border-[#D7E7DB] bg-white p-5 shadow-sm">
          <h2 className="font-bold">Garde-fous de qualité</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[#43594A]">
            <li>• Une source publique ne prouve ni l’existence actuelle ni l’adresse exacte de l’établissement.</li>
            <li>• Seuls les noms complets normalisés identiques sont rapprochés; les annonces vétérinaires sont exclues.</li>
            <li>• Les coordonnées déjà renseignées ne sont pas écrasées. Les coordonnées importées restent à confirmer sur le terrain.</li>
            <li>• Les candidats de l’annuaire ne deviennent jamais des partenaires NAXA et n’acquièrent aucun stock.</li>
          </ul>
          <p className="mt-4 border-t border-[#E6EEE8] pt-4 text-xs text-[#647568]">
            {etat?.attribution ?? "© OpenStreetMap contributors — ODbL"} · Données cartographiques non exhaustives.
          </p>
          <button type="button" onClick={() => void actualiser()} disabled={chargement}
            className="mt-4 rounded-xl border border-[#B8D4C0] px-4 py-2 text-sm font-semibold text-[#0F6B3F] disabled:opacity-50">
            Actualiser l’état
          </button>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-[#F4F8F5] p-3"><p className="text-xs text-[#5C6F62]">{label}</p><p className="mt-1 text-xl font-extrabold tabular-nums">{value}</p></div>;
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="rounded-3xl border border-[#D7E7DB] bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-[#53675A]">{label}</p><p className="mt-2 break-words text-2xl font-extrabold tabular-nums">{value}</p><p className="mt-2 text-xs text-[#738277]">{detail}</p></article>;
}
