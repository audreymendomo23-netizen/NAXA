import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { DeliveryCommissionReport } from "@/components/DeliveryCommissionReport";

export const dynamic="force-dynamic";

export default async function PromoteurLivraisonsPage() {
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/promoteur/livraisons");
  const [{data:profile},{data:role}]=await Promise.all([
    sb.from("profiles").select("actif").eq("id",auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
  ]);
  if(profile?.actif!==true||role!=="promoteur")redirect("/");
  return <main className="mx-auto max-w-6xl space-y-5 px-4 pb-16 pt-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-5 text-white">
      <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Espace Promoteur</p><h1 className="mt-1 text-2xl font-black">Livraisons de mon réseau</h1><p className="mt-1 text-sm text-emerald-100">Livraisons, frais clients et commissions NAXA dues par pharmacie.</p></div>
      <Link href="/pharmacie/promoteur" className="font-bold underline">Retour Promoteur</Link>
    </header>
    <DeliveryCommissionReport/>
  </main>;
}
