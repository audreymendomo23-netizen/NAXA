import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { EspaceNaxaSwitcher } from "@/components/EspaceNaxaSwitcher";

export const dynamic = "force-dynamic";

export default async function LivreurWorkspacePage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/livreur");

  const [{ data: profile, error: profileError }, { data: role, error: roleError }, { data: pharmacyId, error: pharmacyError }] = await Promise.all([
    sb.from("profiles").select("actif").eq("id", auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
    sb.rpc("naxa_active_role_pharmacy"),
  ]);
  if (profileError || roleError || pharmacyError || profile?.actif !== true
    || role !== "livreur" || typeof pharmacyId !== "string") {
    redirect("/");
  }

  const { data: pharmacy, error: pharmacyError2 } = await sb.from("pharmacies")
    .select("nom,actif").eq("id", pharmacyId).maybeSingle();
  if (pharmacyError2 || !pharmacy?.actif) redirect("/");

  return (
    <main className="mx-auto min-h-dvh max-w-3xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] px-4 py-4 text-white">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">NAXA · Poste professionnel</p>
          <h1 className="text-xl font-extrabold">Espace Livreur</h1>
          <p className="text-sm text-emerald-100">{pharmacy.nom}</p>
        </div>
        <EspaceNaxaSwitcher current="livreur" />
      </header>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <h2 className="font-extrabold">Poste attribué, opérations non activées</h2>
        <p className="mt-2 text-sm leading-6">
          Votre poste Livreur est bien actif pour cette pharmacie. Aucun privilège de consultation du stock,
          de gestion des réservations ou de validation de livraison n’est encore configuré pour ce poste.
          Les actions restent donc désactivées jusqu’à la définition explicite de leurs droits.
        </p>
      </section>
      <Link href="/pharmacie" className="inline-flex min-h-11 items-center rounded-xl border px-4 py-2 font-semibold">
        Retour à l’espace pharmacie
      </Link>
    </main>
  );
}
