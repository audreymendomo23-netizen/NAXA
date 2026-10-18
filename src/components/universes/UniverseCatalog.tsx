import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/server";
import { UniverseLanding } from "@/components/universes/UniverseLanding";
import { UniverseProductGrid } from "@/components/universes/UniverseProductGrid";

type UniverseKey = "parapharmacie" | "bebe-maman";
type CatalogProduct = {
  product_id: string; partner_id: string; partner_name: string; universe_slug: string;
  name: string; brand: string | null; category: string; description: string | null;
  photo_url: string | null; price_fcfa: number; available_quantity: number; unit_label: string;
};
const config = {
  parapharmacie: { title: "Parapharmacie", color: "#0B7F85", soft: "#E6F7F6" },
  "bebe-maman": { title: "Bébé & Maman", color: "#C93774", soft: "#FDEEF4" },
};

export async function UniverseCatalog({ universe }: { universe: UniverseKey }) {
  const { data, error } = await supabasePublic(30).rpc("get_universe_catalog", { p_universe_slug: universe });
  if (error) {
    return <><UniverseLanding universe={universe}/><p className="mx-auto mt-3 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Le catalogue est en préparation. Les migrations 099 et 100 doivent être appliquées dans l’ordre avant d’afficher les produits.</p></>;
  }
  const products = (data ?? []) as CatalogProduct[];
  if (!products.length) return <UniverseLanding universe={universe}/>;
  const theme = config[universe];
  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-[#1F2937]"><div className="mx-auto max-w-6xl pt-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="inline-flex min-h-11 items-center rounded-full px-3 font-bold text-[#064B2A]">← NAXA · Accueil</Link><nav className="flex gap-2"><Link href="/parapharmacie" className="min-h-10 rounded-full border px-3 py-2 text-sm font-bold">Parapharmacie</Link><Link href="/bebe-maman" className="min-h-10 rounded-full border px-3 py-2 text-sm font-bold">Bébé & Maman</Link></nav></header>
    <section className="mt-4 rounded-3xl p-6 sm:p-8" style={{backgroundColor:theme.soft}}><p className="text-xs font-extrabold uppercase tracking-widest" style={{color:theme.color}}>NAXA · Retrait auprès du partenaire</p><h1 className="mt-2 text-3xl font-black">{theme.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Consultez les produits disponibles, préparez un panier et réservez auprès d’un partenaire pour un retrait sur place. Aucun paiement en ligne ni livraison n’est proposé ici.</p><p className="mt-3 text-sm font-bold">{products.length} produit(s) disponible(s)</p></section>
    <div className="mt-5"><UniverseProductGrid products={products} universe={universe}/></div>
    <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">Les disponibilités sont calculées en tenant compte des réservations en cours. La réservation ne constitue pas un paiement. Vérifiez le statut avant de vous déplacer.</p>
  </div></main>;
}
