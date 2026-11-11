import { supabasePublic } from "@/lib/supabase/server";
import { UniverseLanding } from "@/components/universes/UniverseLanding";
import { UniverseProductGrid } from "@/components/universes/UniverseProductGrid";
import { ProductImageLibrary } from "@/components/universes/ProductImageLibrary";

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

const actionErrorText: Record<string, string> = {
  stock: "Un article du panier n’est plus disponible ou ne respecte pas les règles de cet univers. Actualisez le catalogue avant de réessayer.",
  compte: "Cette action nécessite un compte client connecté.",
  panier: "Le panier n’a pas pu être lu. Réessayez.",
  reservation: "La réservation n’a pas pu être préparée. Réessayez.",
};

export async function UniverseCatalog({ universe, actionError }: { universe: UniverseKey; actionError?: string }) {
  const actionMessage = actionError ? actionErrorText[actionError] ?? "Cette action n’a pas abouti. Réessayez." : null;
  const actionNotice = actionMessage ? <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{actionMessage}</p> : null;
  const { data, error } = await supabasePublic(30).rpc("get_universe_catalog", { p_universe_slug: universe });
  if (error) {
    return <><UniverseLanding universe={universe}/><div className="mx-auto max-w-3xl px-4">{actionNotice}<p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Le catalogue est temporairement indisponible. Réessayez dans quelques instants.</p></div></>;
  }
  const products = (data ?? []) as CatalogProduct[];
  const theme = config[universe];
  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-[#1F2937]"><div className="mx-auto max-w-6xl pt-4">
    {actionNotice}

    <section className="mt-4 rounded-3xl p-6 sm:p-8" style={{backgroundColor:theme.soft}}><p className="text-xs font-extrabold uppercase tracking-widest" style={{color:theme.color}}>NAXA · Retrait auprès du partenaire</p><h1 className="mt-2 text-3xl font-black">{theme.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{universe === "bebe-maman" ? "Catalogue factuel des articles disponibles auprès des pharmacies partenaires. Aucune publicité, mise en avant sponsorisée ou offre promotionnelle n’est diffusée dans cet univers." : "Consultez les produits disponibles, préparez un panier et réservez auprès d’un partenaire pour un retrait sur place. Aucun paiement en ligne ni livraison n’est proposé ici."}</p><p className="mt-3 text-sm font-bold">{products.length} produit(s) disponible(s)</p></section>
    <div className="mt-5"><ProductImageLibrary universe={universe}/></div>
    <div className="mt-5"><UniverseProductGrid products={products} universe={universe}/></div>
    <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">Les disponibilités sont calculées en tenant compte des réservations en cours. La réservation ne constitue pas un paiement. Vérifiez le statut avant de vous déplacer.</p>
  </div></main>;
}
