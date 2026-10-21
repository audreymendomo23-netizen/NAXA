import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CreancesBordereauxPage() {
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

  const { data: dossiers, error } = await sb.from("dossiers_assurance")
    .select("id,statut,montant_total,montant_prise_en_charge,montant_client,reference_externe,soumis_at,traite_at,created_at,couverture_id")
    .eq("pharmacie_id", profile.pharmacie_id).order("created_at", { ascending: false }).limit(200);
  const rows = dossiers ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.montant_prise_en_charge ?? 0), 0);
  const money = (n: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(n);
  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-16">
    <header className="rounded-2xl bg-naxa-green-900 p-5 text-white"><p className="text-xs uppercase tracking-wide text-emerald-100">NAXA · Comptable</p><h1 className="mt-1 text-2xl font-extrabold">Créances & bordereaux</h1><p className="mt-1 text-sm text-emerald-100">Vue financière des dossiers assurance, sans identité client.</p><Link href="/pharmacie/comptable" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/70 px-4">Retour au tableau de bord</Link></header>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Source indisponible ; données non exhaustives.</p>}
    <section className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border p-4"><p className="text-sm text-slate-600">Dossiers chargés</p><p className="mt-2 text-2xl font-bold">{rows.length}</p></article><article className="rounded-2xl border p-4"><p className="text-sm text-slate-600">Prise en charge chargée</p><p className="mt-2 text-2xl font-bold">{money(total)}</p></article><article className="rounded-2xl border p-4"><p className="text-sm text-slate-600">Référence externe absente</p><p className="mt-2 text-2xl font-bold">{rows.filter(x => !x.reference_externe).length}</p></article></section>
    <section className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Créé le","Statut","Total FCFA","Prise en charge","Part client","Référence externe","Soumis","Traité"].map(h => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="px-3 py-3">{new Date(row.created_at).toLocaleDateString("fr-CM")}</td><td className="px-3 py-3">{row.statut}</td><td className="px-3 py-3">{money(Number(row.montant_total ?? 0))}</td><td className="px-3 py-3">{money(Number(row.montant_prise_en_charge ?? 0))}</td><td className="px-3 py-3">{money(Number(row.montant_client ?? 0))}</td><td className="px-3 py-3">{row.reference_externe ?? "—"}</td><td className="px-3 py-3">{row.soumis_at ? new Date(row.soumis_at).toLocaleDateString("fr-CM") : "—"}</td><td className="px-3 py-3">{row.traite_at ? new Date(row.traite_at).toLocaleDateString("fr-CM") : "—"}</td></tr>)}</tbody></table></section>
    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Lecture seule. Préparation/soumission des bordereaux non activées faute de privilège métier distinct confirmé. Aucun statut n’est modifié.</p>
  </main>;
}