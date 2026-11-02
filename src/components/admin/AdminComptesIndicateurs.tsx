"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type AccountCount = {
  role: string;
  fonction_interne: string;
  actif: boolean;
  total: number;
};

type Metrics = Record<string, number | null>;

type PharmacyRow = {
  id: string;
  nom: string;
  actif: boolean;
  promoteurs: { id: string; nom: string }[];
  comptes: AccountCount[];
  indicateurs: Metrics;
};

type PromoterRow = {
  id: string;
  nom: string;
  actif: boolean;
  pharmacies_total: number;
  pharmacies: { id: string; nom: string }[];
  comptes: AccountCount[];
  indicateurs: Metrics;
};

type Payload = {
  version: number;
  periode: { jours: number; du: string; au: string };
  comptes_globaux: AccountCount[];
  totaux: Metrics;
  par_pharmacie: PharmacyRow[];
  par_promoteur: PromoterRow[];
  sources: Record<string, boolean>;
  partenaires_globaux: {
    totaux: {
      partenaires_total: number;
      partenaires_actifs: number;
      partenaires_en_attente: number;
      partenaires_suspendus: number;
      membres_partenaires_total: number;
      membres_partenaires_uniques: number;
    };
    par_type_statut: { type: string; statut: string; total: number }[];
  };
  note_scope: string;
};

const accountLabel = (role: string, fonction: string) => {
  if (role === "client") return "Client";
  if (role === "admin") return "Administrateur";
  if (role === "promoteur") return "Promoteur";
  if (fonction === "responsable") return "Responsable";
  if (role === "caisse" || fonction === "caisse") return "Caisse";
  if (fonction === "pharmacien") return "Pharmacien";
  if (fonction === "gestionnaire_stock" || fonction === "magasinier") return "Gestionnaire de stock";
  if (fonction === "comptable") return "Comptable";
  return fonction && fonction !== "(aucune)" ? fonction : role;
};

const number = (value: number | null | undefined) =>
  value === null || value === undefined ? "Indisponible" : value.toLocaleString("fr-FR");

const money = (value: number | null | undefined) =>
  value === null || value === undefined ? "Indisponible" : value.toLocaleString("fr-FR") + " FCFA";

const metricLabels: Record<string, string> = {
  clients_avec_reservation: "Clients avec réservation",
  reservations: "Réservations",
  ventes_marketplace: "Ventes Marketplace",
  ca_marketplace_fcfa: "CA Marketplace",
  ventes_pos_payees: "Ventes POS payées",
  ca_pos_fcfa: "CA POS",
  references_stock: "Références en stock",
  stocks_bas: "Stocks bas (≤ 5)",
  ruptures_stock: "Ruptures",
  lots_a_controler: "Lots à contrôler",
  inventaires_ouverts: "Inventaires ouverts",
  consultations_pharmaceutiques: "Consultations",
  prescriptions: "Prescriptions",
  preparations_prescriptions: "Préparations d'ordonnances",
  evenements_audit_pharmacien: "Événements d'audit Pharmacien",
  caisses_actives: "Caisses actives",
  sessions_caisse: "Sessions de caisse",
  ecarts_caisse_a_verifier: "Écarts de caisse à vérifier",
  depenses: "Dépenses enregistrées",
  montant_depenses_fcfa: "Montant des dépenses",
  mouvements_tresorerie: "Mouvements de trésorerie",
  montant_tresorerie_brut_fcfa: "Trésorerie brute",
  dossiers_assurance: "Dossiers d'assurance",
  montant_prise_en_charge_fcfa: "Prise en charge assurance",
  services_pharmacien_pointes: "Services Pharmacien pointés",
  services_stock_pointes: "Services Stock pointés",
  affectations_professionnelles_actives: "Affectations professionnelles actives",
  controles_comptables_a_traiter: "Contrôles comptables à traiter",
  evenements_comptables_a_traiter: "Événements comptables à traiter",
  periodes_comptables_ouvertes: "Périodes comptables ouvertes",
  ecritures_comptables: "Écritures comptables",
};

const formatMetric = (key: string, value: number | null | undefined) =>
  key.endsWith("_fcfa") || key.startsWith("montant_") ? money(value) : number(value);

const sourceLabels: Record<string, string> = {
  affectations_professionnelles: "Affectations professionnelles",
  preparations_prescriptions: "Préparations d'ordonnances",
  audit_pharmacien: "Journal d'audit Pharmacien",
  controles_comptables: "Contrôles comptables",
  evenements_comptables: "Événements comptables",
  periodes_comptables: "Périodes comptables",
  ecritures_comptables: "Écritures comptables",
};

function accountCount(groups: AccountCount[]) {
  return groups.reduce((sum, group) => sum + group.total, 0);
}

export default function AdminComptesIndicateurs({ jours }: { jours: number }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const sb = supabaseBrowser();
        const { data: result, error: rpcError } = await sb.rpc("admin_comptes_indicateurs", { p_jours: jours });
        if (rpcError) throw new Error(
          rpcError.code === "PGRST202" || rpcError.code === "42883"
            ? "Le service de consolidation des comptes n'est pas encore disponible sur cet environnement."
            : "Les indicateurs des autres comptes sont indisponibles pour ce périmètre Admin."
        );
        if (!result || typeof result !== "object" || !("totaux" in result) || !("par_pharmacie" in result)) {
          throw new Error("Le moteur de consolidation a renvoyé une réponse incomplète.");
        }
        if (live) setData(result as Payload);
      } catch (cause) {
        if (live) {
          setData(null);
          setError(cause instanceof Error ? cause.message : "Chargement des indicateurs impossible.");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [jours]);

  const activeSourcesMissing = useMemo(
    () => Object.entries(data?.sources ?? {}).filter(([, available]) => !available).map(([key]) => sourceLabels[key] ?? key),
    [data]
  );

  const summary = data?.totaux;

  return (
    <section className="space-y-4 rounded-3xl border border-[#0147BB]/15 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="admin-comptes-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#0147BB]">Étape 13 · Comptes et indicateurs globaux</p>
          <h2 id="admin-comptes-title" className="mt-1 text-xl font-black text-slate-950">Vue consolidée des autres comptes</h2>
          <p className="mt-1 text-sm text-slate-600">Clients, Promoteurs, Responsables, Caisses, Pharmaciens, Gestionnaires de stock et Comptables — agrégés sans données de santé ni identifiants clients.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{jours} jours glissants</span>
      </header>

      {loading && <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Consolidation des comptes et indicateurs…</p>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      {data && summary && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500">Clients actifs / total</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{number(summary.clients_actifs)} / {number(summary.clients_total)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500">Promoteurs actifs / total</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{number(summary.promoteurs_actifs)} / {number(summary.promoteurs_total)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500">Comptes professionnels</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{number(summary.comptes_professionnels)}</p>
            <p className="mt-1 text-xs text-slate-500">Hors clients et Admin</p>
          </article>
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500">Pharmacies du réseau</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{number(summary.pharmacies_actives)} / {number(summary.pharmacies_total)}</p>
            <p className="mt-1 text-xs text-slate-500">Actives / total non démo</p>
          </article>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl bg-[#F4F8F5] p-4">
            <p className="text-xs font-semibold text-slate-600">Réservations réseau</p>
            <p className="mt-1 text-xl font-black">{number(summary.reservations)}</p>
          </article>
          <article className="rounded-2xl bg-[#F4F8F5] p-4">
            <p className="text-xs font-semibold text-slate-600">CA Marketplace</p>
            <p className="mt-1 text-xl font-black">{money(summary.ca_marketplace_fcfa)}</p>
          </article>
          <article className="rounded-2xl bg-[#F4F8F5] p-4">
            <p className="text-xs font-semibold text-slate-600">CA POS payé</p>
            <p className="mt-1 text-xl font-black">{money(summary.ca_pos_fcfa)}</p>
          </article>
          <article className="rounded-2xl bg-[#F4F8F5] p-4">
            <p className="text-xs font-semibold text-slate-600">Stocks bas / ruptures</p>
            <p className="mt-1 text-xl font-black">{number(summary.stocks_bas)} / {number(summary.ruptures_stock)}</p>
          </article>
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold text-slate-950">Comptes partenaires Marketplace · périmètre séparé</h3>
          <p className="text-xs text-slate-500">Les partenaires et leurs membres ne sont pas rattachés à une pharmacie ni à un Promoteur; ils sont donc comptabilisés séparément.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">Partenaires actifs / total</p><p className="mt-1 text-xl font-black">{number(data.partenaires_globaux.totaux.partenaires_actifs)} / {number(data.partenaires_globaux.totaux.partenaires_total)}</p></article>
            <article className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">En attente / suspendus</p><p className="mt-1 text-xl font-black">{number(data.partenaires_globaux.totaux.partenaires_en_attente)} / {number(data.partenaires_globaux.totaux.partenaires_suspendus)}</p></article>
            <article className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">Membres partenaires</p><p className="mt-1 text-xl font-black">{number(data.partenaires_globaux.totaux.membres_partenaires_total)}</p></article>
            <article className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">Membres distincts</p><p className="mt-1 text-xl font-black">{number(data.partenaires_globaux.totaux.membres_partenaires_uniques)}</p></article>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Type de partenaire</th><th className="p-3">Statut</th><th className="p-3 text-right">Nombre</th></tr></thead>
              <tbody>
                {data.partenaires_globaux.par_type_statut.map((item,index) => <tr key={item.type + item.statut + index} className="border-t border-slate-100"><td className="p-3 font-semibold">{item.type.replace(/_/g," ")}</td><td className="p-3">{item.statut}</td><td className="p-3 text-right font-bold">{number(item.total)}</td></tr>)}
                {!data.partenaires_globaux.par_type_statut.length && <tr><td colSpan={3} className="p-4 text-center text-slate-500">Aucun partenaire Marketplace recensé.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold text-slate-950">Comptes recensés par type et fonction</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Compte</th><th className="p-3">État</th><th className="p-3 text-right">Nombre</th></tr></thead>
              <tbody>
                {data.comptes_globaux.map((group, index) => <tr key={group.role + group.fonction_interne + String(group.actif) + index} className="border-t border-slate-100">
                  <td className="p-3 font-semibold">{accountLabel(group.role, group.fonction_interne)}</td>
                  <td className="p-3">{group.actif ? "Actif" : "Inactif"}</td>
                  <td className="p-3 text-right font-bold tabular-nums">{number(group.total)}</td>
                </tr>)}
                {!data.comptes_globaux.length && <tr><td colSpan={3} className="p-4 text-center text-slate-500">Aucun compte recensé.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold text-slate-950">Ventilation par pharmacie</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <th className="p-3">Pharmacie</th><th className="p-3 text-right">Comptes</th><th className="p-3 text-right">Réservations</th><th className="p-3 text-right">CA Marketplace</th><th className="p-3 text-right">CA POS</th><th className="p-3 text-right">Stocks bas</th>
              </tr></thead>
              <tbody>
                {data.par_pharmacie.map(ph => <tr key={ph.id} className="border-t border-slate-100 align-top">
                  <td className="p-3"><span className="font-bold">{ph.nom}</span><span className={"mt-1 block text-xs " + (ph.actif ? "text-emerald-700" : "text-slate-500")}>{ph.actif ? "Active" : "Inactive"}</span>
                    {ph.promoteurs.length > 0 && <span className="mt-1 block text-xs text-slate-500">Promoteur(s) : {ph.promoteurs.map(p => p.nom).join(", ")}</span>}
                    <span className="mt-1 block text-xs text-slate-500">{ph.comptes.map(c => accountLabel(c.role, c.fonction_interne) + " " + (c.actif ? "actif" : "inactif") + " : " + c.total).join(" · ") || "Aucun compte rattaché"}</span>
                  </td>
                  <td className="p-3 text-right font-bold tabular-nums">{number(accountCount(ph.comptes))}</td>
                  <td className="p-3 text-right tabular-nums">{number(ph.indicateurs.reservations)}</td>
                  <td className="p-3 text-right tabular-nums">{money(ph.indicateurs.ca_marketplace_fcfa)}</td>
                  <td className="p-3 text-right tabular-nums">{money(ph.indicateurs.ca_pos_fcfa)}</td>
                  <td className="p-3 text-right tabular-nums">{number(ph.indicateurs.stocks_bas)}</td>
                </tr>)}
                {!data.par_pharmacie.length && <tr><td colSpan={6} className="p-4 text-center text-slate-500">Aucune pharmacie non démo dans le périmètre.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold text-slate-950">Ventilation par Promoteur</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <th className="p-3">Promoteur</th><th className="p-3 text-right">Pharmacies</th><th className="p-3 text-right">Comptes rattachés</th><th className="p-3 text-right">Réservations</th><th className="p-3 text-right">CA Marketplace</th><th className="p-3 text-right">CA POS</th>
              </tr></thead>
              <tbody>
                {data.par_promoteur.map(prom => <tr key={prom.id} className="border-t border-slate-100">
                  <td className="p-3"><span className="font-bold">{prom.nom}</span><span className={"mt-1 block text-xs " + (prom.actif ? "text-emerald-700" : "text-slate-500")}>{prom.actif ? "Actif" : "Inactif"}</span>
                    <span className="mt-1 block text-xs text-slate-500">{prom.pharmacies.map(ph => ph.nom).join(", ") || "Aucun rattachement actif"}</span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{number(prom.pharmacies_total)}</td>
                  <td className="p-3 text-right tabular-nums">{number(accountCount(prom.comptes))}</td>
                  <td className="p-3 text-right tabular-nums">{number(prom.indicateurs.reservations)}</td>
                  <td className="p-3 text-right tabular-nums">{money(prom.indicateurs.ca_marketplace_fcfa)}</td>
                  <td className="p-3 text-right tabular-nums">{money(prom.indicateurs.ca_pos_fcfa)}</td>
                </tr>)}
                {!data.par_promoteur.length && <tr><td colSpan={6} className="p-4 text-center text-slate-500">Aucun compte Promoteur recensé.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold text-slate-950">Sources métiers complémentaires</h3>
          {activeSourcesMissing.length ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Sources non déployées sur cet environnement : {activeSourcesMissing.join(", ")}. Les indicateurs correspondants restent « Indisponible » et ne sont pas assimilés à zéro.</p> : <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Toutes les sources complémentaires attendues sont présentes.</p>}
          <p className="text-xs leading-5 text-slate-500">{data.note_scope}</p>
        </div>
      </>}
    </section>
  );
}
