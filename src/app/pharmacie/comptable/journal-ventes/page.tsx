import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Vente = {
  id: string; numero_vente: string | null; statut: string; remise: number;
  total_brut: number; total_net: number; mode_paiement: string | null;
  paiement_ref: string | null; created_at: string; paid_at: string | null;
  caisse_session_id: string | null;
};

const fcfa = (value: number | null | undefined) =>
  new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(value ?? 0);
const dateFr = (value: string) =>
  new Intl.DateTimeFormat("fr-CM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default async function JournalVentesPage({ searchParams }: { searchParams?: Promise<{ debut?: string; fin?: string; statut?: string }> }) {
  const filters = await searchParams;
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/journal-ventes");

  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("id,actif,pharmacie_id").eq("id", auth.user.id).single();
  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", { p_pharmacie: profile.pharmacie_id });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const debut = /^\d{4}-\d{2}-\d{2}$/.test(filters?.debut ?? "") ? searchParams!.debut! : "";
  const fin = /^\d{4}-\d{2}-\d{2}$/.test(filters?.fin ?? "") ? searchParams!.fin! : "";
  const statut = ["payee", "annulee", "brouillon"].includes(filters?.statut ?? "") ? searchParams!.statut! : "";
  let query = sb.from("ventes")
    .select("id,numero_vente,statut,remise,total_brut,total_net,mode_paiement,paiement_ref,created_at,paid_at,caisse_session_id")
    .eq("pharmacie_id", profile.pharmacie_id)
    .order("created_at", { ascending: false }).limit(200);
  if (debut) query = query.gte("created_at", debut + "T00:00:00");
  if (fin) query = query.lt("created_at", fin + "T23:59:59.999");
  if (statut) query = query.eq("statut", statut);
  const { data, error } = await query;
  const rows = (data ?? []) as Vente[];
  const totalPaye = rows.filter((v) => v.statut === "payee").reduce((sum, v) => sum + (v.total_net ?? 0), 0);
  const nbPaye = rows.filter((v) => v.statut === "payee").length;

  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-16">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-naxa-green-900 p-5 text-white">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">NAXA · Comptable</p><h1 className="mt-1 text-2xl font-extrabold">Journal des ventes</h1><p className="mt-1 text-sm text-emerald-100">Lecture seule des ventes sources — aucune action de caisse</p></div>
      <Link href="/pharmacie/comptable" className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold">Retour au tableau de bord</Link>
    </header>
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-medium text-slate-700">Date de début<input name="debut" type="date" defaultValue={debut} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      <label className="text-sm font-medium text-slate-700">Date de fin<input name="fin" type="date" defaultValue={fin} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      <label className="text-sm font-medium text-slate-700">Statut<select name="statut" defaultValue={statut} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="">Tous les statuts</option><option value="payee">Payée</option><option value="annulee">Annulée</option><option value="brouillon">Brouillon</option></select></label>
      <div className="flex items-end gap-2"><button className="min-h-11 rounded-xl bg-naxa-green-900 px-4 font-semibold text-white">Filtrer</button><Link href="/pharmacie/comptable/journal-ventes" className="rounded-xl border border-slate-300 px-4 py-3 text-sm">Réinitialiser</Link></div>
    </form>
    {error ? <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Le journal des ventes n’a pas pu être chargé. Vérifiez les droits de lecture et la disponibilité de la table source.</section> : <>
      <section className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Ventes chargées</p><p className="mt-2 text-2xl font-extrabold">{rows.length}</p><p className="text-xs text-slate-500">Maximum 200 lignes récentes</p></article><article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Ventes payées dans la liste</p><p className="mt-2 text-2xl font-extrabold">{nbPaye}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Total net payé affiché</p><p className="mt-2 text-2xl font-extrabold">{fcfa(totalPaye)}</p><p className="text-xs text-slate-500">Sous-ensemble affiché, pas un total de période exhaustif</p></article></section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-4"><h2 className="font-bold">Ventes enregistrées</h2><p className="mt-1 text-sm text-slate-600">La TVA n’est pas affichée car aucune colonne de TVA enregistrée n’a été confirmée dans la table source. Aucune identité client ni donnée d’ordonnance n’est chargée.</p></div>
        {rows.length === 0 ? <p className="p-5 text-sm text-slate-600">Aucune vente correspondant aux filtres.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">{["Date de vente","Référence","Caisse","Statut","Brut","Remise","Net","Paiement"].map((h)=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{rows.map(v=><tr key={v.id} className="border-b last:border-0"><td className="whitespace-nowrap px-3 py-3">{dateFr(v.paid_at ?? v.created_at)}</td><td className="px-3 py-3 font-medium">{v.numero_vente ?? v.id.slice(0,8)}</td><td className="px-3 py-3">{v.caisse_session_id ? v.caisse_session_id.slice(0,8) : "—"}</td><td className="px-3 py-3">{v.statut}</td><td className="px-3 py-3">{fcfa(v.total_brut)}</td><td className="px-3 py-3">{fcfa(v.remise)}</td><td className="px-3 py-3 font-semibold">{fcfa(v.total_net)}</td><td className="px-3 py-3">{v.mode_paiement ?? "—"}</td></tr>)}</tbody></table></div>}
      </section>
    </>}
    <p className="text-xs leading-5 text-slate-500">Source métier : public.ventes. Les données restent en lecture seule. Les filtres de période ne transforment pas cette liste bornée en état comptable exhaustif. Export PDF/Excel et TVA enregistrée attendent la confirmation des sources et formats applicables.</p>
  </main>;
}
