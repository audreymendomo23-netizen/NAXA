import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const fcfa = (value: number) => new Intl.NumberFormat("fr-CM", {
  style: "currency", currency: "XAF", maximumFractionDigits: 0,
}).format(value);
const validDate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
};
const endExclusive = (value: string) => new Date(Date.parse(value + "T00:00:00+01:00") + 86400000).toISOString();

export default async function RapportsExportsPage({ searchParams }: { searchParams?: { debut?: string; fin?: string } }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/rapports-exports");
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("id,actif,pharmacie_id").eq("id", auth.user.id).single();
  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("naxa_can", {
    p_privilege: "MANAGE_ACCOUNTING", p_pharmacie: profile.pharmacie_id, p_target: null,
  });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const debut = validDate(searchParams?.debut);
  const fin = validDate(searchParams?.fin);
  const invalidPeriod = Boolean(debut && fin && debut > fin);
  const fromTimestamp = debut ? debut + "T00:00:00+01:00" : null;
  const toTimestamp = fin ? endExclusive(fin) : null;

  let salesQuery = sb.from("ventes").select("statut,total_net,created_at,paid_at")
    .eq("pharmacie_id", profile.pharmacie_id).order("created_at", { ascending: false }).limit(5000);
  let expensesQuery = sb.from("depenses").select("montant,date_depense,statut")
    .eq("pharmacie_id", profile.pharmacie_id).order("date_depense", { ascending: false }).limit(5000);
  let cashQuery = sb.from("tresorerie_mouvements").select("montant,date_operation,nature")
    .eq("pharmacie_id", profile.pharmacie_id).order("date_operation", { ascending: false }).limit(5000);
  let entriesQuery = sb.from("compta_ecriture").select("id,date_ecriture")
    .eq("pharmacie_id", profile.pharmacie_id).order("date_ecriture", { ascending: false }).limit(5000);
  if (fromTimestamp) {
    salesQuery = salesQuery.gte("created_at", fromTimestamp);
    expensesQuery = expensesQuery.gte("date_depense", debut);
    cashQuery = cashQuery.gte("date_operation", fromTimestamp);
    entriesQuery = entriesQuery.gte("date_ecriture", debut);
  }
  if (toTimestamp) {
    salesQuery = salesQuery.lt("created_at", toTimestamp);
    expensesQuery = expensesQuery.lte("date_depense", fin!);
    cashQuery = cashQuery.lt("date_operation", toTimestamp);
    entriesQuery = entriesQuery.lte("date_ecriture", fin!);
  }
  const [salesResult, expensesResult, cashResult, entriesResult] = invalidPeriod
    ? [{ data: null, error: { message: "Période invalide" } }, { data: null, error: { message: "Période invalide" } }, { data: null, error: { message: "Période invalide" } }, { data: null, error: { message: "Période invalide" } }] as const
    : await Promise.all([salesQuery, expensesQuery, cashQuery, entriesQuery]);
  const { data: scheduledReports, error: scheduledReportsError } = await sb.from("rapports")
    .select("id,periode,du,au,texte,created_at,contenu")
    .eq("scope_type", "PHARMACIE").eq("scope_pharmacie_id", profile.pharmacie_id)
    .not("contenu->compta_naxa", "is", null)
    .order("created_at", { ascending: false }).limit(12);
  const { data: exportHistory, error: exportHistoryError } = await sb.from("compta_audit")
    .select("sequence_no,acteur_id,action,objet_type,objet_id,resultat,motif,horodatage")
    .eq("pharmacie_id", profile.pharmacie_id).eq("action", "export_generation")
    .order("horodatage", { ascending: false }).limit(50);

  const sales = salesResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const movements = cashResult.data ?? [];
  const entries = entriesResult.data ?? [];
  const hasErrors = Boolean(salesResult.error || expensesResult.error || cashResult.error || entriesResult.error);
  const paidSales = sales.filter(row => row.statut === "payee");
  const totalPaid = paidSales.reduce((sum, row) => sum + (row.total_net ?? 0), 0);
  const expenseTotal = expenses.reduce((sum, row) => sum + (row.montant ?? 0), 0);
  const movementTotal = movements.reduce((sum, row) => sum + (row.montant ?? 0), 0);
  const truncated = [sales, expenses, movements, entries].some(rows => rows.length === 5000);
  const qs = (type: string, format: string) => {
    const params = new URLSearchParams({ type, format });
    if (debut) params.set("debut", debut);
    if (fin) params.set("fin", fin);
    return "/api/pharmacie/comptable/exports?" + params.toString();
  };

  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-16">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-naxa-green-900 p-5 text-white">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">NAXA · Comptable</p><h1 className="mt-1 text-2xl font-extrabold">Rapports & exports</h1><p className="mt-1 text-sm text-emerald-100">Synthèses issues des sources métier, sans données de santé nominatives</p></div>
      <Link href="/pharmacie/comptable" className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold">Retour au tableau de bord</Link>
    </header>
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
      <label className="text-sm font-medium text-slate-700">Début de période<input name="debut" type="date" defaultValue={debut} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      <label className="text-sm font-medium text-slate-700">Fin de période<input name="fin" type="date" defaultValue={fin} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      <div className="flex items-end gap-2"><button className="min-h-11 rounded-xl bg-naxa-green-900 px-4 font-semibold text-white">Appliquer</button><Link href="/pharmacie/comptable/rapports-exports" className="rounded-xl border border-slate-300 px-4 py-3 text-sm">Réinitialiser</Link></div>
    </form>
    {invalidPeriod && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">La date de début doit être antérieure ou égale à la date de fin.</p>}
    {hasErrors && !invalidPeriod && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Certaines sources ne sont pas accessibles. Les indicateurs concernés ne doivent pas être interprétés comme des zéros ou comme un état complet.</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Ventes payées chargées</p><p className="mt-2 text-2xl font-extrabold">{sales.filter(row => row.statut === "payee").length}</p><p className="mt-1 text-sm text-slate-600">{fcfa(totalPaid)}</p><p className="text-xs text-slate-500">Total net des ventes payées chargées</p></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Dépenses enregistrées</p><p className="mt-2 text-2xl font-extrabold">{expenses.length}</p><p className="mt-1 text-sm text-slate-600">{fcfa(expenseTotal)}</p><p className="text-xs text-slate-500">Toutes les dépenses chargées, sans déduction de statut</p></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Mouvements de trésorerie</p><p className="mt-2 text-2xl font-extrabold">{movements.length}</p><p className="mt-1 text-sm text-slate-600">{fcfa(movementTotal)}</p><p className="text-xs text-slate-500">Somme brute des mouvements, entrées et sorties non compensées</p></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Écritures comptables</p><p className="mt-2 text-2xl font-extrabold">{entries.length}</p><p className="mt-1 text-xs text-slate-500">Écritures enregistrées sur la période</p></article>
    </section>
    {truncated && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Au moins une source atteint la limite de 5 000 lignes. Les indicateurs affichés sont partiels ; resserrez la période et vérifiez l’en-tête de l’export avant de l’utiliser.</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold">Générer un rapport</h2>
      <p className="mt-1 text-sm text-slate-600">Choisissez une source et un format. Les téléchargements recontrôlent la session, le privilège et la pharmacie côté serveur.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          {type:"ventes", title:"Journal des ventes", description:"Références, statuts, brut, remises, net et paiement."},
          {type:"depenses", title:"Dépenses", description:"Dates, références, montants et statuts enregistrés."},
          {type:"tresorerie", title:"Trésorerie", description:"Mouvements et références sources, sans libellé libre."},
          {type:"ecritures", title:"Journal comptable", description:"Dates, journaux et références d’écritures comptables."},
        ].map(item => <article key={item.type} className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.description}</p>
          <div className="mt-3 flex flex-wrap gap-2"><a href={qs(item.type,"csv")} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold">CSV</a><a href={qs(item.type,"xlsx")} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold">Excel</a><a href={qs(item.type,"pdf")} className="inline-flex min-h-11 items-center rounded-xl bg-naxa-green-900 px-4 text-sm font-semibold text-white">PDF</a></div>
        </article>)}
      </div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold">Rapports mensuels planifiés</h2>
      <p className="mt-1 text-sm text-slate-600">Le job est défini dans la migration additive et doit être installé sur la base cible. Cette liste n’affiche que les rapports comptables marqués par le schéma NAXA.</p>
      {scheduledReportsError ? <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Les rapports planifiés ne sont pas accessibles.</p>
        : !scheduledReports?.length ? <p className="mt-3 text-sm text-slate-600">Aucun rapport planifié disponible pour ce périmètre.</p>
        : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">{["Généré le","Période","Ventes payées FCFA","Dépenses FCFA","Mouvements bruts FCFA"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{scheduledReports.map(report=>{const data=(report.contenu as {compta_naxa?:{ventes_payees_total_net_fcfa?:number;depenses_enregistrees_fcfa?:number;mouvements_tresorerie_bruts_fcfa?:number}})?.compta_naxa;return <tr key={report.id} className="border-b"><td className="px-3 py-3">{new Date(report.created_at).toLocaleDateString("fr-CM")}</td><td className="px-3 py-3">{report.du} — {report.au}</td><td className="px-3 py-3">{fcfa(data?.ventes_payees_total_net_fcfa??0)}</td><td className="px-3 py-3">{fcfa(data?.depenses_enregistrees_fcfa??0)}</td><td className="px-3 py-3">{fcfa(data?.mouvements_tresorerie_bruts_fcfa??0)}</td></tr>})}</tbody></table></div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold">Historique récent des exports</h2>
      <p className="mt-1 text-sm text-slate-600">Journal comptable append-only, limité aux 50 dernières générations. Aucun contenu exporté ni donnée patient n’est conservé ici.</p>
      {exportHistoryError ? <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Le journal d’export n’est pas accessible dans cet environnement. Aucun historique n’est inventé.</p>
        : !exportHistory?.length ? <p className="mt-3 text-sm text-slate-600">Aucun export journalisé pour le moment.</p>
        : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">{["Date","Type","Fichier logique","Résultat","Détails techniques"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{exportHistory.map(event=><tr key={event.sequence_no} className="border-b last:border-0"><td className="whitespace-nowrap px-3 py-3">{new Intl.DateTimeFormat("fr-CM",{dateStyle:"medium",timeStyle:"short"}).format(new Date(event.horodatage))}</td><td className="px-3 py-3">{event.objet_type}</td><td className="px-3 py-3">{event.objet_id ?? "—"}</td><td className="px-3 py-3">{event.resultat}</td><td className="px-3 py-3">{event.motif ?? "—"}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
      <h2 className="font-bold">Périmètre et limites</h2>
      <p className="mt-1">Les rapports utilisent les dates et montants effectivement enregistrés dans NAXA. Aucune TVA n’est calculée ou supposée. La somme de trésorerie est brute et ne représente pas un solde net. Les exports sont limités à 5 000 lignes par source ; l’en-tête indique si la limite est atteinte.</p>
      <p className="mt-1">Les générations d’exports sont journalisées dans la table comptable append-only existante. L’historique affiché est limité aux 50 événements récents et n’enregistre pas le contenu des fichiers. Mention d’usage : « État préparé par NAXA, à contrôler par votre expert-comptable ».</p>
    </section>
  </main>;
}
