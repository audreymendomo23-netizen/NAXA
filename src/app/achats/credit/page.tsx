import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { DemandeCreditMarketplaceForm } from "@/components/DemandeCreditMarketplaceForm";

export default async function DemandeCreditMarketplacePage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/achats/credit");
  const { data: pharmacies, error } = await sb.from("pharmacies").select("id,nom")
    .eq("actif", true).eq("visible_recherche", true).order("nom", { ascending: true });
  return <main className="mx-auto min-h-dvh max-w-lg px-4 pb-10 pt-5">
    <Link href="/panier" className="text-sm font-semibold text-naxa-green-900 underline">← Retour au panier</Link>
    <header className="mt-4 rounded-2xl bg-[#0B3D26] p-5 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Marketplace</p>
      <h1 className="mt-2 text-2xl font-black">Demande d’achat à crédit</h1>
      <p className="mt-2 text-sm text-white/85">La demande est soumise à validation. Le stock n’est débité qu’après approbation.</p>
    </header>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">Impossible de charger les pharmacies disponibles.</p>}
    {!error && <div className="mt-4"><DemandeCreditMarketplaceForm pharmacies={pharmacies ?? []}/></div>}
  </main>;
}
