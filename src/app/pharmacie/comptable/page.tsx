import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { EspaceNaxaSwitcher } from "@/components/EspaceNaxaSwitcher";
import RapportsALaDemande from "@/components/RapportsALaDemande";

export const dynamic = "force-dynamic";

type Evenement = {
  id: string;
  evenement_type: string;
  source_type: string;
  source_id: string;
  date_evenement: string;
  statut: "a_traiter" | "en_cours" | "traite" | "erreur";
  code_erreur: string | null;
  created_at: string;
};

type Ecriture = {
  id: string;
  date_ecriture: string;
  journal_code: string;
  reference_source: string | null;
  libelle: string;
  source_type: string;
  source_id: string;
  created_at: string;
};

const dateFr = (value: string) =>
  new Intl.DateTimeFormat("fr-CM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default async function ComptableDashboardPage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable");

  const [{ data: profile, error: profileError }, { data: activeRole, error: roleError }, { data: pharmacieId, error: pharmacyRoleError }] = await Promise.all([
    sb.from("profiles").select("id,actif").eq("id", auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
    sb.rpc("naxa_active_role_pharmacy"),
  ]);

  if (profileError || roleError || pharmacyRoleError || !profile || profile.actif !== true
    || activeRole !== "comptable" || typeof pharmacieId !== "string") {
    redirect("/pharmacie");
  }

  const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", { p_pharmacie: pharmacieId });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const [{ data: pharmacy, error: pharmacyError }, { data: evenements, error: eventsError },
    { data: ecritures, error: entriesError }, { data: periodes, error: periodsError }] = await Promise.all([
    sb.from("pharmacies").select("nom").eq("id", pharmacieId).maybeSingle(),
    sb.from("compta_evenement")
      .select("id,evenement_type,source_type,source_id,date_evenement,statut,code_erreur,created_at")
      .eq("pharmacie_id", pharmacieId)
      .order("created_at", { ascending: false }).limit(12),
    sb.from("compta_ecriture")
      .select("id,date_ecriture,journal_code,reference_source,libelle,source_type,source_id,created_at")
      .eq("pharmacie_id", pharmacieId)
      .order("date_ecriture", { ascending: false }).limit(8),
    sb.from("compta_periodes")
      .select("id,date_debut,date_fin,statut")
      .eq("pharmacie_id", pharmacieId)
      .order("date_debut", { ascending: false }).limit(4),
  ]);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthStartDate = monthStart.toISOString().slice(0, 10);
  const nextMonthStartDate = nextMonthStart.toISOString().slice(0, 10);
  const [salesResult, expensesResult, cashResult, claimsResult, controlsResult, auditIntegrity] = await Promise.all([
    sb.from("ventes").select("statut,total_net,created_at").eq("pharmacie_id", pharmacieId)
      .gte("created_at", monthStartDate + "T00:00:00+01:00").lt("created_at", nextMonthStartDate + "T00:00:00+01:00").limit(5000),
    sb.from("depenses").select("montant,date_depense,statut").eq("pharmacie_id", pharmacieId)
      .gte("date_depense", monthStartDate).lt("date_depense", nextMonthStartDate).limit(5000),
    sb.from("tresorerie_mouvements").select("montant,nature,date_operation").eq("pharmacie_id", pharmacieId)
      .gte("date_operation", monthStartDate + "T00:00:00+01:00").lt("date_operation", nextMonthStartDate + "T00:00:00+01:00").limit(5000),
    sb.from("dossiers_assurance").select("statut,montant_prise_en_charge,created_at").eq("pharmacie_id", pharmacieId)
      .gte("created_at", monthStartDate + "T00:00:00+01:00").lt("created_at", nextMonthStartDate + "T00:00:00+01:00").limit(5000),
    sb.from("compta_controles_cloture").select("controle_code,statut").eq("pharmacie_id", pharmacieId).limit(1000),
    sb.rpc("compta_verifier_audit", { p_pharmacie: pharmacieId }),
  ]);

  const error = pharmacyError || eventsError || entriesError || periodsError;
  const eventRows = (evenements ?? []) as Evenement[];
  const paidSales = salesResult.data?.filter(row => row.statut === "payee") ?? [];
  const paidSalesTotal = paidSales.reduce((sum, row) => sum + BigInt(String(row.total_net ?? 0)), 0n);
  const expenseTotal = (expensesResult.data ?? []).reduce((sum, row) => sum + BigInt(String(row.montant ?? 0)), 0n);
  const cashGrossTotal = (cashResult.data ?? []).reduce((sum, row) => sum + BigInt(String(row.montant ?? 0)), 0n);
  const claimRows = claimsResult.data ?? [];
  const claimStatuses = [...new Set(claimRows.map(row => String(row.statut)))].sort();
  const controlRows = controlsResult.data ?? [];
  const controlPending = controlRows.filter(row => row.statut === "a_controler").length;
  const monthlySourceErrors = [salesResult.error, expensesResult.error, cashResult.error, claimsResult.error, controlsResult.error].some(Boolean);
  const monthlyTruncated = [salesResult.data, expensesResult.data, cashResult.data, claimsResult.data].some(rows => rows?.length === 5000);
  const auditState = auditIntegrity.error ? "indisponible" : auditIntegrity.data === true ? "valide" : "invalide";
  const fcfa = (value: bigint) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(value);

  const entryRows = (ecritures ?? []) as Ecriture[];
  const openPeriods = (periodes ?? []).filter((period) => period.statut === "ouverte").length;
  const pending = eventRows.filter((event) => event.statut === "a_traiter" || event.statut === "en_cours").length;
  const failed = eventRows.filter((event) => event.statut === "erreur").length;
  const treated = eventRows.filter((event) => event.statut === "traite").length;

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 pb-16">
      <header className="-mx-4 flex flex-wrap items-center justify-between gap-3 bg-naxa-green-900 px-4 py-4 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">NAXA · Poste Comptable</p>
          <h1 className="mt-1 text-xl font-extrabold">{pharmacy?.nom ?? "Ma pharmacie"}</h1>
          <p className="mt-1 text-sm text-emerald-100">Consultation et contrôle — aucune action de caisse</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><EspaceNaxaSwitcher current="comptable" /><Link href="/pharmacie/assurance" className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold hover:bg-white/10">Suivi Assurance</Link><Link href="/pharmacie" className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold hover:bg-white/10">
          Espace pharmacie
        </Link></div>
      </header>

      {error ? (
        <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Les données comptables ne peuvent pas être chargées. Aucun montant n’est remplacé par une valeur fictive. Vérifiez les droits et l’application des migrations sur l’environnement de test.
        </section>
      ) : (
        <>
          <nav aria-label="Navigation Comptable" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/pharmacie/comptable/journal-ventes" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-600">
              <span className="text-sm font-semibold text-emerald-800">Journal des ventes</span><p className="mt-1 text-sm text-slate-600">Ventes sources et montants enregistrés, en lecture seule.</p>
            </Link>
            <Link href="/pharmacie/comptable/rapprochements" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-600">
              <span className="text-sm font-semibold text-emerald-800">Trésorerie & rapprochements</span><p className="mt-1 text-sm text-slate-600">Comparer les mouvements de trésorerie aux ventes payées.</p>
            </Link>
            <Link href="/pharmacie/comptable/creances-bordereaux" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-600"><span className="text-sm font-semibold text-emerald-800">Créances & bordereaux</span><p className="mt-1 text-sm text-slate-600">Dossiers assurance et montants en lecture seule.</p></Link>
            <Link href="/pharmacie/comptable/rejets-relances" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-600"><span className="text-sm font-semibold text-emerald-800">Rejets & relances</span><p className="mt-1 text-sm text-slate-600">Dossiers refusés ou incomplets à examiner.</p></Link>
            <Link href="/pharmacie/comptable/rapports-exports" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-600">
              <span className="text-sm font-semibold text-emerald-800">Rapports & exports</span><p className="mt-1 text-sm text-slate-600">Synthèses de période et téléchargements CSV/Excel sécurisés.</p>
            </Link>
            <Link href="/pharmacie/comptable/clotures" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-600">
              <span className="text-sm font-semibold text-emerald-800">Clôtures comptables</span><p className="mt-1 text-sm text-slate-600">Contrôles documentés, verrouillage de période et vérification de la chaîne.</p>
            </Link>
            <Link href="/pharmacie/comptable/journal-audit" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-600">
              <span className="text-sm font-semibold text-emerald-800">Journal d’audit</span><p className="mt-1 text-sm text-slate-600">Historique des actions comptables, en lecture seule.</p>
            </Link>
            <Link href="/pharmacie/comptable/documents" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-600">
              <span className="text-sm font-semibold text-emerald-800">Documents</span><p className="mt-1 text-sm text-slate-600">Rapports, références d’abonnement et rappels de lots autorisés.</p>
            </Link>
            <Link href="/pharmacie/comptabilite/plan" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm hover:border-emerald-600"><span className="text-sm font-semibold text-emerald-900">Plan comptable & mappings</span><p className="mt-1 text-sm text-emerald-800">Configurer et valider les comptes et correspondances selon les droits accordés.</p></Link>
            <Link href="/pharmacie/comptable/referentiels" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-600">
              <span className="text-sm font-semibold text-emerald-800">Assureurs & fournisseurs</span><p className="mt-1 text-sm text-slate-600">Référentiels et commandes consultables sans modification.</p>
            </Link>
            <Link href="/pharmacie/comptable/service" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm hover:border-emerald-600">
              <span className="text-sm font-semibold text-emerald-900">Prise / fin de service</span><p className="mt-1 text-sm text-emerald-800">Enregistrer les heures réelles et consulter mon historique de service.</p>
            </Link>
            <Link href="/pharmacie/comptable/profil" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-600">
              <span className="text-sm font-semibold text-emerald-800">Profil & déconnexion</span><p className="mt-1 text-sm text-slate-600">Compte, pharmacie rattachée et fermeture de session.</p>
            </Link>
          </nav>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">Écritures récentes</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{entryRows.length}</p>
              <p className="mt-1 text-xs text-slate-500">Dernières écritures affichées, maximum 8</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">Événements en attente</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{pending}</p>
              <p className="mt-1 text-xs text-slate-500">Sur les 12 derniers événements chargés</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">Événements en erreur</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{failed}</p>
              <p className="mt-1 text-xs text-slate-500">Sur les 12 derniers événements chargés</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">Périodes ouvertes</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{openPeriods}</p>
              <p className="mt-1 text-xs text-slate-500">Parmi les 4 périodes les plus récentes</p>
            </article>
          </section>

          <Link href="/pharmacie/assurance" className="inline-flex rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900">Suivi Assurance, créances et remboursements</Link>
          <RapportsALaDemande variant="comptable" />

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold text-slate-950">Pilotage comptable 360°</h2><p className="mt-1 text-sm text-slate-600">Indicateurs calculés depuis les sources accessibles pour la période du {monthStartDate} au {new Date(nextMonthStart.getTime() - 86400000).toISOString().slice(0,10)}.</p></div>
              <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (auditState === "valide" ? "bg-emerald-50 text-emerald-800" : auditState === "invalide" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900")}>Chaîne d’audit : {auditState === "valide" ? "vérifiée" : auditState === "invalide" ? "alerte" : "non vérifiée"}</span>
            </div>
            {monthlySourceErrors ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Au moins une source de pilotage est indisponible. Les indicateurs de cette source ne doivent pas être interprétés comme des zéros.</p> : null}
            {monthlyTruncated ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Une source a atteint la limite de 5 000 lignes ; les sommes sont partielles. Réduisez la période avant de prendre une décision.</p> : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-600">Ventes payées</p><p className="mt-2 text-xl font-extrabold">{salesResult.error ? "Indisponible" : paidSales.length}</p><p className="mt-1 text-sm text-slate-600">{salesResult.error ? "Source inaccessible" : fcfa(paidSalesTotal)}</p></article>
              <article className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-600">Dépenses enregistrées</p><p className="mt-2 text-xl font-extrabold">{expensesResult.error ? "Indisponible" : expensesResult.data?.length ?? 0}</p><p className="mt-1 text-sm text-slate-600">{expensesResult.error ? "Source inaccessible" : fcfa(expenseTotal)}</p><p className="mt-1 text-xs text-slate-500">Statuts non déduits du total</p></article>
              <article className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-600">Mouvements de trésorerie</p><p className="mt-2 text-xl font-extrabold">{cashResult.error ? "Indisponible" : cashResult.data?.length ?? 0}</p><p className="mt-1 text-sm text-slate-600">{cashResult.error ? "Source inaccessible" : fcfa(cashGrossTotal)}</p><p className="mt-1 text-xs text-slate-500">Somme brute, entrées/sorties non compensées</p></article>
              <article className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-600">Dossiers d’assurance</p><p className="mt-2 text-xl font-extrabold">{claimsResult.error ? "Indisponible" : claimRows.length}</p><p className="mt-1 text-xs text-slate-500">Dossiers créés sur la période, sans identité client</p></article>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">Contrôles de clôture</h3><p className="mt-2 text-2xl font-extrabold">{controlsResult.error ? "Indisponible" : controlPending}</p><p className="text-sm text-slate-600">Contrôles à traiter sur les périodes accessibles</p><Link href="/pharmacie/comptable/clotures" className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold">Ouvrir les clôtures</Link></article>
              <article className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">Statuts des dossiers d’assurance</h3>{claimsResult.error ? <p className="mt-2 text-sm text-amber-800">Source indisponible.</p> : claimStatuses.length ? <ul className="mt-2 space-y-1 text-sm">{claimStatuses.map(status => <li key={status} className="flex justify-between gap-3"><span>{status}</span><span className="font-semibold">{claimRows.filter(row => String(row.statut) === status).length}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucun dossier sur cette période.</p>}</article>
            </div>
            <p className="text-xs text-slate-500">TVA, paie, bilan réglementaire et valeur du stock ne sont pas affichés comme des KPI tant que leurs sources et règles de calcul ne sont pas confirmées. La chaîne d’audit « valide » signifie que le contrôle disponible a réussi, pas que les données métier sont certifiées.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Journal comptable récent</h2>
                <p className="mt-1 text-sm text-slate-600">Consultation en lecture seule. Aucun détail de patient n’est affiché.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{treated} événements traités dans la file récente</span>
            </div>
            {entryRows.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune écriture disponible pour ce périmètre, ou le socle comptable n’est pas encore initialisé.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="px-3 py-3">Date</th><th className="px-3 py-3">Journal</th><th className="px-3 py-3">Libellé</th><th className="px-3 py-3">Référence</th>
                  </tr></thead>
                  <tbody>{entryRows.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3 whitespace-nowrap">{entry.date_ecriture}</td>
                      <td className="px-3 py-3">{entry.journal_code}</td>
                      <td className="px-3 py-3">{entry.libelle}</td>
                      <td className="px-3 py-3">{entry.reference_source ?? entry.source_id}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">État de l’outbox</h2>
            <p className="mt-1 text-sm text-slate-600">Le worker ne passe un événement en « traité » qu’après création de l’écriture correspondante.</p>
            {eventRows.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucun événement disponible. Les données apparaîtront après application des migrations et émission par les sources métier.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {eventRows.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{event.evenement_type}</p>
                      <p className="mt-1 text-xs text-slate-500">{event.source_type} · {event.source_id} · {dateFr(event.date_evenement)}</p>
                      {event.code_erreur && <p className="mt-1 text-xs text-amber-700">Code de traitement : {event.code_erreur}</p>}
                    </div>
                    <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (event.statut === "traite" ? "bg-emerald-50 text-emerald-800" : event.statut === "erreur" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800")}>
                      {event.statut === "traite" ? "Traité" : event.statut === "erreur" ? "À investiguer" : event.statut === "en_cours" ? "En cours" : "À traiter"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs leading-5 text-slate-500">Les indicateurs sont limités aux lignes chargées et ne constituent pas une balance complète. Les montants et calculs ne sont pas affichés tant que les données sources et mappings validés ne sont pas disponibles. État actualisé à l’ouverture de la page.</p>
        </>
      )}
    </main>
  );
}
