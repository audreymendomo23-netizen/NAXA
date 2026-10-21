import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Dossier = {
  id: string; statut: string; montant_total: number | string | null;
  montant_prise_en_charge: number | string | null; montant_client: number | string | null;
  reference_externe: string | null; soumis_at: string | null; traite_at: string | null;
  created_at: string; couverture_id: string | null;
};

export default async function CreancesBordereauxPage({ searchParams }: { searchParams?: { assureur?: string } }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/creances-bordereaux");
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("id,actif,pharmacie_id").eq("id", auth.user.id).single();
  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("naxa_can", {
    p_privilege: "MANAGE_ACCOUNTING", p_pharmacie: profile.pharmacie_id, p_target: null,
  });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const [dossiersResult, insurersResult] = await Promise.all([
    sb.from("dossiers_assurance").select("id,statut,montant_total,montant_prise_en_charge,montant_client,reference_externe,soumis_at,traite_at,created_at,couverture_id")
      .eq("pharmacie_id", profile.pharmacie_id).order("created_at", { ascending: false }).limit(200),
    sb.from("assureurs").select("id,nom,code,actif").eq("actif", true).order("nom", { ascending: true }).limit(200),
  ]);
  const rows = (dossiersResult.data ?? []) as Dossier[];
  const coverageIds = [...new Set(rows.map(row => row.couverture_id).filter((id): id is string => Boolean(id)))];
  const coverageResult = coverageIds.length ? await sb.from("couvertures_assurance").select("id,assureur_id").in("id", coverageIds) : { data: [], error: null };
  const insurerIds = [...new Set((coverageResult.data ?? []).map(row => row.assureur_id).filter(Boolean))];
  const insurerLookup = insurerIds.length ? await sb.from("assureurs").select("id,nom,code,actif").in("id", insurerIds) : { data: [], error: null };
  const insurers = insurersResult.data ?? [];
  const names = new Map((insurerLookup.data ?? []).map(row => [row.id, row.nom]));
  const insurerForCoverage = new Map((coverageResult.data ?? []).map(row => [row.id, row.assureur_id]));
  const selected = searchParams?.assureur && /^[0-9a-f-]{36}$/i.test(searchParams.assureur) ? searchParams.assureur : "";
  const allRows = rows.map(row => ({ ...row, assureurId: row.couverture_id ? insurerForCoverage.get(row.couverture_id) ?? "" : "" }));
  const visibleRows = selected ? allRows.filter(row => row.assureurId === selected) : allRows;
  const total = visibleRows.reduce((sum, row) => sum + Number(row.montant_prise_en_charge ?? 0), 0);
  const money = (n: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(n);
  const dates = (value: string | null) => value ? new Date(value).toLocaleDateString("fr-CM") : "—";

  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-16">
    <header className="rounded-2xl bg-naxa-green-900 p-5 text-white"><p className="text-xs uppercase tracking-wide text-emerald-100">NAXA · Comptable</p><h1 className="mt-1 text-2xl font-extrabold">Créances & bordereaux</h1><p className="mt-1 text-sm text-emerald-100">Préparation d’un aperçu financier par assureur, sans identité client.</p><Link href="/pharmacie/comptable" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/70 px-4">Retour au tableau de bord</Link></header>
    {dossiersResult.error || coverageResult.error || insurerLookup.error ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Une source est indisponible ; les données affichées peuvent être incomplètes.</p> : null}
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"><label className="min-w-[240px] flex-1 text-sm font-medium text-slate-700">Filtrer par assureur<select name="assureur" defaultValue={selected} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="">Tous les assureurs</option>{insurers.map(insurer => <option key={insurer.id} value={insurer.id}>{insurer.nom}</option>)}</select></label><button className="min-h-11 rounded-xl bg-naxa-green-900 px-4 font-semibold text-white">Appliquer</button><Link href="/pharmacie/comptable/creances-bordereaux" className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm">Réinitialiser</Link></form>
    <section className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border p-4"><p className="text-sm text-slate-600">Dossiers dans l’aperçu</p><p className="mt-2 text-2xl font-bold">{visibleRows.length}</p></article><article className="rounded-2xl border p-4"><p className="text-sm text-slate-600">Prise en charge de l’aperçu</p><p className="mt-2 text-2xl font-bold">{money(total)}</p></article><article className="rounded-2xl border p-4"><p className="text-sm text-slate-600">Référence externe absente</p><p className="mt-2 text-2xl font-bold">{visibleRows.filter(row => !row.reference_externe).length}</p></article></section>
    <section className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Créé le","Assureur","Statut","Total FCFA","Prise en charge","Part client","Référence externe","Soumis","Traité"].map(h => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{visibleRows.map(row => <tr key={row.id} className="border-t"><td className="px-3 py-3">{dates(row.created_at)}</td><td className="px-3 py-3">{names.get(row.assureurId) ?? "Assureur non visible"}</td><td className="px-3 py-3">{row.statut}</td><td className="px-3 py-3">{money(Number(row.montant_total ?? 0))}</td><td className="px-3 py-3">{money(Number(row.montant_prise_en_charge ?? 0))}</td><td className="px-3 py-3">{money(Number(row.montant_client ?? 0))}</td><td className="px-3 py-3">{row.reference_externe ?? "—"}</td><td className="px-3 py-3">{dates(row.soumis_at)}</td><td className="px-3 py-3">{dates(row.traite_at)}</td></tr>)}</tbody></table></section>
    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">L’aperçu ne modifie pas les créances sources. La création persistante d’un bordereau, sa soumission au Promoteur, le dépôt et le rapprochement de paiement restent désactivés tant que le modèle métier et les privilèges atomiques dédiés ne sont pas confirmés. Aucun format assureur officiel n’est généré sans modèle validé.</p>
  </main>;
}
