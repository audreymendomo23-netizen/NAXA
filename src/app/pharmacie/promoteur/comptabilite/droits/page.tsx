import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { ComptaDroitsManager } from "@/components/pharmacie/ComptaDroitsManager";

export const dynamic = "force-dynamic";

export default async function PromoteurComptaDroitsPage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/promoteur/comptabilite/droits");
  const [{ data: role, error: roleError }, { data: rows, error }] = await Promise.all([
    sb.rpc("naxa_business_function"),
    sb.rpc("compta_promoteur_lister_comptables", { p_pharmacie: null }),
  ]);
  if (roleError || role !== "promoteur") redirect("/pharmacie");
  if (error) {
    return <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <Link href="/pharmacie/promoteur" className="text-sm font-semibold text-emerald-900">← Retour à l’espace Promoteur</Link>
      <h1 className="text-2xl font-extrabold">Droits comptables</h1>
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Impossible de charger les Comptables du réseau. Aucun droit n’a été modifié.</p>
    </main>;
  }
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-16">
    <header className="rounded-3xl bg-naxa-green-900 p-5 text-white sm:p-7">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">NAXA · Espace Promoteur</p>
      <h1 className="mt-2 text-2xl font-extrabold">Droits de gestion comptable</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">Vous gardez le droit de configurer et valider le plan comptable et les mappings. Gérez séparément le droit d’écriture de chaque Comptable affecté à vos pharmacies.</p>
    </header>
    <ComptaDroitsManager rows={(rows ?? []) as Array<{
      pharmacie_id:string; pharmacie_nom:string; comptable_id:string; nom:string|null;
      username:string|null; compte_actif:boolean; ecriture_autorisee:boolean;
    }>}/>
    <footer className="flex flex-wrap gap-2">
      <Link href="/pharmacie/comptabilite/plan" className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-900">Plan comptable & mappings</Link>
      <Link href="/pharmacie/promoteur/comptabilite" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">Tableau comptable réseau</Link>
      <Link href="/pharmacie/promoteur" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">Espace Promoteur</Link>
    </footer>
  </main>;
}
