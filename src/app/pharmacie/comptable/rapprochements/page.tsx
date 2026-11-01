import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Mouvement = { id: string; nature: string; montant: number; libelle: string; reference: string | null; source_type: string | null; source_id: string | null; date_operation: string; compte_id: string | null };
type Vente = { id: string; numero_vente: string | null; total_net: number; mode_paiement: string | null; paid_at: string | null; created_at: string; paiement_ref: string | null };

const fcfa = (value: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(value);
const dateFr = (value: string) => new Intl.DateTimeFormat("fr-CM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default async function RapprochementsPage({ searchParams }: { searchParams?: { debut?: string; fin?: string } }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/rapprochements");
  const { data: profile, error: profileError } = await sb.from("profiles").select("id,actif,pharmacie_id").eq("id", auth.user.id).single();
  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", { p_pharmacie: profile.pharmacie_id });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const debut = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.debut ?? "") ? searchParams!.debut! : "";
  const fin = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.fin ?? "") ? searchParams!.fin! : "";
  let mouvementsQuery = sb.from("tresorerie_mouvements").select("id,nature,montant,libelle,reference,source_type,source_id,date_operation,compte_id").eq("pharmacie_id", profile.pharmacie_id).order("date_operation", { ascending: false }).limit(200);
  let ventesQuery = sb.from("ventes").select("id,numero_vente,total_net,mode_paiement,paid_at,created_at,paiement_ref").eq("pharmacie_id", profile.pharmacie_id).eq("statut", "payee").order("paid_at", { ascending: false }).limit(200);
  if (debut) { mouvementsQuery = mouvementsQuery.gte("date_operation", debut + "T00:00:00"); ventesQuery = ventesQuery.gte("paid_at", debut + "T00:00:00"); }
  if (fin) { mouvementsQuery = mouvementsQuery.lt("date_operation", fin + "T23:59:59.999"); ventesQuery = ventesQuery.lt("paid_at", fin + "T23:59:59.999"); }
  const [movementResult, saleResult] = await Promise.all([mouvementsQuery, ventesQuery]);
  const movementRows = (movementResult.data ?? []) as Mouvement[];
  const saleRows = (saleResult.data ?? []) as Vente[];
  const movementError = movementResult.error;
  const saleError = saleResult.error;
  const salesById = new Map(saleRows.map(v => [v.id, v]));
  const linkedSales = movementRows.filter(m => m.source_type === "vente" && m.source_id && salesById.has(m.source_id));
  const unmatchedSales = saleRows.filter(v => !movementRows.some(m => m.source_type === "vente" && m.source_id === v.id));
  const linkedAmount = linkedSales.reduce((sum,m)=>sum + (m.montant ?? 0),0);
  const unmatchedAmount = unmatchedSales.reduce((sum,v)=>sum + (v.total_net ?? 0),0);
  const hasMore = movementRows.length === 200 || saleRows.length === 200;

  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-16">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-naxa-green-900 p-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">NAXA · Comptable</p><h1 className="mt-1 text-2xl font-extrabold">Trésorerie & rapprochements</h1><p className="mt-1 text-sm text-emerald-100">Comparaison en lecture seule des sources existantes</p></div><Link href="/pharmacie/comptable" className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold">Retour au tableau de bord</Link></header>
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3"><label className="text-sm font-medium text-slate-700">Date de début<input name="debut" type="date" defaultValue={debut} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3"/></label><label className="text-sm font-medium text-slate-700">Date de fin<input name="fin" type="date" defaultValue={fin} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3"/></label><div className="flex items-end gap-2"><button className="min-h-11 rounded-xl bg-naxa-green-900 px-4 font-semibold text-white">Filtrer</button><Link href="/pharmacie/comptable/rapprochements" className="rounded-xl border border-slate-300 px-4 py-3 text-sm">Réinitialiser</Link></div></form>
    {movementError || saleError ? <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Une ou plusieurs sources de rapprochement ne sont pas accessibles. Les résultats ne peuvent pas être considérés comme complets. {movementError ? "Mouvements de trésorerie indisponibles. " : ""}{saleError ? "Ventes payées indisponibles." : ""}</section> : <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Mouvements chargés</p><p className="mt-2 text-2xl font-extrabold">{movementRows.length}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Ventes payées chargées</p><p className="mt-2 text-2xl font-extrabold">{saleRows.length}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Mouvements liés à une vente chargée</p><p className="mt-2 text-2xl font-extrabold">{linkedSales.length}</p><p className="mt-1 text-xs text-slate-500">{fcfa(linkedAmount)} — somme des mouvements liés</p></article><article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Ventes sans mouvement correspondant chargé</p><p className="mt-2 text-2xl font-extrabold">{unmatchedSales.length}</p><p className="mt-1 text-xs text-slate-500">{fcfa(unmatchedAmount)} — montant des ventes concernées</p></article></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">Mouvements de trésorerie</h2><p className="mt-1 text-sm text-slate-600">Lecture de public.tresorerie_mouvements. Aucun mouvement n’est créé, modifié ou validé depuis cet écran.</p>{movementRows.length===0?<p className="mt-3 text-sm text-slate-600">Aucun mouvement pour la période.</p>:<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">{["Date","Nature","Libellé","Référence","Montant","Lien source"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{movementRows.map(m=><tr key={m.id} className="border-b last:border-0"><td className="whitespace-nowrap px-3 py-3">{dateFr(m.date_operation)}</td><td className="px-3 py-3">{m.nature}</td><td className="px-3 py-3">{m.libelle}</td><td className="px-3 py-3">{m.reference ?? "—"}</td><td className="px-3 py-3 font-semibold">{fcfa(m.montant)}</td><td className="px-3 py-3">{m.source_type ?? "—"}{m.source_id ? " · "+m.source_id.slice(0,8) : ""}</td></tr>)}</tbody></table></div>}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">Ventes payées sans mouvement lié dans l’échantillon</h2><p className="mt-1 text-sm text-slate-600">Une vente est considérée « sans lien » seulement si aucun mouvement de source_type vente et source_id égal à son identifiant n’apparaît parmi les 200 mouvements chargés. Ce n’est pas une preuve de manque d’encaissement.</p>{unmatchedSales.length===0?<p className="mt-3 text-sm text-slate-600">Aucune vente sans lien dans les résultats chargés.</p>:<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">{["Date","Référence vente","Mode de paiement","Montant net","Référence paiement"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{unmatchedSales.map(v=><tr key={v.id} className="border-b last:border-0"><td className="px-3 py-3">{v.paid_at ? dateFr(v.paid_at) : dateFr(v.created_at)}</td><td className="px-3 py-3">{v.numero_vente ?? v.id.slice(0,8)}</td><td className="px-3 py-3">{v.mode_paiement ?? "—"}</td><td className="px-3 py-3 font-semibold">{fcfa(v.total_net)}</td><td className="px-3 py-3">{v.paiement_ref ?? "—"}</td></tr>)}</tbody></table></div>}</section>
      {hasMore && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Limite d’échantillon atteinte (200 lignes pour au moins une source). Ce rapprochement n’est pas exhaustif ; réduisez la période avant toute conclusion.</p>}
    </>}
    <p className="text-xs leading-5 text-slate-500">Les correspondances reposent uniquement sur les références explicites source_type/source_id. Aucun rapprochement approximatif par montant n’est présenté comme certain. Les clôtures de caisse ne sont pas encore incluses car leur schéma opérationnel n’a pas été confirmé dans cette tranche.</p>
  </main>;
}
