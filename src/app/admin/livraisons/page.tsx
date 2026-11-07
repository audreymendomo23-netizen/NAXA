import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { isDemoPharmacy } from "@/lib/admin/is-demo-pharmacy";
import { PharmacyDeliveryConfig } from "@/components/PharmacyDeliveryConfig";
import { DeliveryCommissionReport } from "@/components/DeliveryCommissionReport";

export const dynamic="force-dynamic";

export default async function AdminLivraisonsPage() {
  const { sb } = await requireAdminActive("/admin/livraisons");
  const { data, error } = await sb.from("pharmacies")
    .select("id,nom,actif,livraison_active,rayon_livraison_km,lat,lng,est_demo")
    .order("nom");
  const pharmacies = (data??[]).filter(p=>!isDemoPharmacy(p.nom,p.est_demo));
  return <main className="mx-auto max-w-6xl space-y-5 px-4 pb-16 pt-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-5 text-white">
      <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Administration</p><h1 className="mt-1 text-2xl font-black">Livraisons & commissions</h1><p className="mt-1 text-sm text-emerald-100">Réseau, tarifs, suivi régional et régularisation mensuelle.</p></div>
      <Link href="/admin" className="font-bold underline">Retour Administration</Link>
    </header>
    {error&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">La configuration des pharmacies est partielle : la lecture de la base a échoué.</p>}
    <PharmacyDeliveryConfig pharmacies={pharmacies.map(p=>({
      id:p.id,nom:p.nom,livraison_active:Boolean(p.livraison_active),
      rayon_livraison_km:Number(p.rayon_livraison_km??10),
      lat:typeof p.lat==="number"?p.lat:null,lng:typeof p.lng==="number"?p.lng:null,
    }))}/>
    <DeliveryCommissionReport/>
  </main>;
}
