import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const dateFr = (value: string | null) => value ? new Intl.DateTimeFormat("fr-CM", { dateStyle: "medium" }).format(new Date(value)) : "—";

export default async function ReferentielsComptablePage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/referentiels");
  const [{ data: profile, error: profileError }, { data: activeRole, error: roleError }, { data: pharmacieId, error: pharmacyRoleError }] = await Promise.all([
    sb.from("profiles").select("id,actif").eq("id", auth.user.id).single(),
    sb.rpc("naxa_business_function"),
    sb.rpc("naxa_active_role_pharmacy"),
  ]);
  if (profileError || roleError || pharmacyRoleError || !profile || profile.actif !== true
    || activeRole !== "comptable" || typeof pharmacieId !== "string") redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", {
    p_pharmacie: pharmacieId,
  });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const [ordersResult, suppliersResult, insurersResult] = await Promise.all([
    sb.from("commandes_fournisseurs")
      .select("id,reference,statut,date_commande,date_reception,fournisseur_id")
      .eq("pharmacie_id", pharmacieId).order("date_commande", { ascending: false }).limit(100),
    sb.from("fournisseurs").select("id,nom,actif,created_at").order("nom", { ascending: true }).limit(100),
    sb.from("assureurs").select("id,nom,code,actif").eq("actif", true).order("nom", { ascending: true }).limit(100),
  ]);
  const supplierIds = [...new Set((ordersResult.data ?? []).map(row => row.fournisseur_id).filter(Boolean))];
  const suppliers = (suppliersResult.data ?? []).filter(row => supplierIds.includes(row.id) || row.actif);
  const supplierName = new Map(suppliers.map(row => [row.id, row.nom]));

  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-16">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-naxa-green-900 p-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">NAXA · Comptable</p><h1 className="mt-1 text-2xl font-extrabold">Référentiels & commandes</h1><p className="mt-1 text-sm text-emerald-100">Assureurs, fournisseurs et commandes en lecture seule.</p></div><Link href="/pharmacie/comptable" className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold">Retour au tableau de bord</Link></header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-lg font-bold">Commandes fournisseurs</h2><p className="mt-1 text-sm text-slate-600">Périmètre de la pharmacie courante ; aucune action de modification ou réception depuis le poste Comptable.</p>
      {ordersResult.error ? <p role="alert" className="mt-3 text-sm text-red-700">Commandes indisponibles.</p> : (ordersResult.data ?? []).length === 0 ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Aucune commande enregistrée.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3">Référence</th><th className="p-3">Fournisseur</th><th className="p-3">Statut</th><th className="p-3">Commandée le</th><th className="p-3">Réception</th></tr></thead><tbody>{(ordersResult.data ?? []).map(row => <tr key={row.id} className="border-b border-slate-100"><td className="p-3 font-mono">{row.reference ?? "—"}</td><td className="p-3">{supplierName.get(row.fournisseur_id) ?? "Fournisseur non visible"}</td><td className="p-3">{row.statut}</td><td className="p-3">{dateFr(row.date_commande)}</td><td className="p-3">{dateFr(row.date_reception)}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-lg font-bold">Fournisseurs visibles</h2>{suppliersResult.error ? <p role="alert" className="mt-3 text-sm text-red-700">Fournisseurs indisponibles.</p> : suppliers.length === 0 ? <p className="mt-3 text-sm text-slate-600">Aucun fournisseur visible.</p> : <ul className="mt-3 divide-y divide-slate-100">{suppliers.map(row => <li key={row.id} className="flex items-center justify-between gap-3 py-3"><span>{row.nom}</span><span className="text-xs text-slate-500">{row.actif ? "Actif" : "Inactif"}</span></li>)}</ul>}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-lg font-bold">Assureurs actifs</h2>{insurersResult.error ? <p role="alert" className="mt-3 text-sm text-red-700">Assureurs indisponibles.</p> : (insurersResult.data ?? []).length === 0 ? <p className="mt-3 text-sm text-slate-600">Aucun assureur actif enregistré.</p> : <ul className="mt-3 divide-y divide-slate-100">{(insurersResult.data ?? []).map(row => <li key={row.id} className="py-3"><p className="font-semibold">{row.nom}</p><p className="text-xs text-slate-500">Code : {row.code ?? "—"}</p></li>)}</ul>}</div>
    </section>
    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Limite : les colonnes disponibles ne confirment pas de montants de commande ni de pièces de facture téléchargeables. Les données absentes ne sont pas estimées.</p>
  </main>;
}
