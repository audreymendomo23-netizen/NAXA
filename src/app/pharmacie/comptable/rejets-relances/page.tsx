import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RejetsRelancesPage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/rejets-relances");
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("id,actif,pharmacie_id").eq("id", auth.user.id).single();
  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("naxa_can", {
    p_privilege: "MANAGE_ACCOUNTING", p_pharmacie: profile.pharmacie_id, p_target: null,
  });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const { data: dossiers, error } = await sb.from("dossiers_assurance")
    .select("id,statut,montant_total,montant_prise_en_charge,reference_externe,motif_refus,traite_at,created_at")
    .eq("pharmacie_id", profile.pharmacie_id).order("created_at", { ascending: false }).limit(200);
  const rows = dossiers ?? [];
  const rejected = rows.filter(row => /rejet|refus/i.test(String(row.statut)));
  const incomplete = rows.filter(row => !row.reference_externe || !row.traite_at);
  const attention = rows.filter(row => rejected.some(item => item.id === row.id) || incomplete.some(item => item.id === row.id));
  const money = (n: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(n);
  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-16">
    <header className="rounded-2xl bg-naxa-green-900 p-5 text-white"><p className="text-xs uppercase tracking-wide text-emerald-100">NAXA · Comptable</p><h1 className="mt-1 text-2xl font-extrabold">Rejets & relances</h1><p className="mt-1 text-sm text-emerald-100">Repérer les dossiers refusés et les données à vérifier.</p><Link href="/pharmacie/comptable" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/70 px-4">Retour au tableau de bord</Link></header>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Source indisponible ; données non exhaustives.</p>}
    <section className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border p-4"><p className="text-sm text-slate-600">Refus/rejets identifiés</p><p className="mt-2 text-2xl font-bold">{rejected.length}</p></article><article className="rounded-2xl border p-4"><p className="text-sm text-slate-600">À vérifier</p><p className="mt-2 text-2xl font-bold">{incomplete.length}</p></article><article className="rounded-2xl border p-4"><p className="text-sm text-slate-600">Montant pris en charge des rejets</p><p className="mt-2 text-2xl font-bold">{money(rejected.reduce((sum, row) => sum + Number(row.montant_prise_en_charge ?? 0), 0))}</p></article></section>
    <section className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Date","Référence dossier","Statut","Montant","Motif source","Référence externe","Traité le"].map(h => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{attention.map(row => <tr key={row.id} className="border-t"><td className="px-3 py-3">{new Date(row.created_at).toLocaleDateString("fr-CM")}</td><td className="px-3 py-3">{row.id.slice(0,8)}</td><td className="px-3 py-3">{row.statut}</td><td className="px-3 py-3">{money(Number(row.montant_prise_en_charge ?? row.montant_total ?? 0))}</td><td className="px-3 py-3">{row.motif_refus ?? "Aucun motif enregistré"}</td><td className="px-3 py-3">{row.reference_externe ?? "Manquante"}</td><td className="px-3 py-3">{row.traite_at ? new Date(row.traite_at).toLocaleDateString("fr-CM") : "Non renseigné"}</td></tr>)}</tbody></table></section>
    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Un dossier incomplet n’est pas automatiquement un rejet. Aucune relance n’est envoyée et aucun statut n’est modifié : le schéma des tâches et un privilège atomique de relance restent à confirmer. Aucune donnée nominative de client n’est affichée.</p>
  </main>;
}