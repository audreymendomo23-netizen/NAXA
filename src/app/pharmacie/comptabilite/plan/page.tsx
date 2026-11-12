import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { ComptaPlanManager } from "@/components/pharmacie/ComptaPlanManager";

export const dynamic = "force-dynamic";

export default async function ComptaPlanPage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptabilite/plan");
  const [{ data: role, error: roleError }, { data: pharmacies, error: pharmaciesError }] = await Promise.all([
    sb.rpc("naxa_business_function"),
    sb.rpc("compta_plan_lister_pharmacies"),
  ]);
  if (roleError || pharmaciesError || (role !== "promoteur" && role !== "comptable")) redirect("/pharmacie");
  const rows = (pharmacies ?? []) as Array<{ pharmacie_id: string; pharmacie_nom: string }>;
  if (!rows.length) return <main className="mx-auto max-w-5xl space-y-4 px-4 py-6"><Link href="/pharmacie" className="text-sm font-semibold">← Retour</Link><h1 className="text-2xl font-extrabold">Plan comptable & mappings</h1><p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">Aucune pharmacie active n’est disponible dans votre périmètre comptable.</p></main>;
  const [{ data: initialData, error }, { data: initialConfig, error: configError }] = await Promise.all([
    sb.rpc("compta_plan_lire", { p_pharmacie: rows[0].pharmacie_id }),
    sb.rpc("compta_config_lire", { p_pharmacie: rows[0].pharmacie_id }),
  ]);
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-16">
    <header className="rounded-3xl bg-naxa-green-900 p-5 text-white sm:p-7">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">NAXA · Comptabilité</p>
      <h1 className="mt-2 text-2xl font-extrabold">Plan comptable & mappings</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">Configuration et validation des comptes et correspondances événementielles. Ces droits n’autorisent pas les opérations de caisse, ventes ou trésorerie.</p>
    </header>
    {error || configError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-900">Impossible de charger le plan ou la configuration comptable. Aucun changement n’a été effectué.</p> :
      <ComptaPlanManager pharmacies={rows} initialPharmacy={rows[0].pharmacie_id} initialData={initialData as never} initialConfig={initialConfig as never} role={role as "promoteur" | "comptable"} />}
    <footer className="flex flex-wrap gap-2">
      <Link href={role === "promoteur" ? "/pharmacie/promoteur/comptabilite" : "/pharmacie/comptable"} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">Retour au tableau comptable</Link>
      {role === "promoteur" && <Link href="/pharmacie/promoteur/comptabilite/droits" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">Droits comptables</Link>}
    </footer>
  </main>;
}
