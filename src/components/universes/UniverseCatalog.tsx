import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/server";
import { UniverseLanding } from "@/components/universes/UniverseLanding";
import { reserverProduit } from "@/app/univers-actions";

type UniverseKey = "parapharmacie" | "bebe-maman";
type CatalogProduct = {
  product_id: string;
  partner_id: string;
  partner_name: string;
  universe_slug: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  photo_url: string | null;
  price_fcfa: number;
  available_quantity: number;
  unit_label: string;
};

const config = {
  parapharmacie: { title: "Parapharmacie", color: "#096A6F", soft: "#E6F7F6" },
  "bebe-maman": { title: "Bébé & Maman", color: "#AD2D63", soft: "#FDEEF4" },
};

function fcfa(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) + " FCFA";
}

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
    <section className="mt-4 rounded-3xl p-6 sm:p-8" style={{backgroundColor:theme.soft}}><p className="text-xs font-extrabold uppercase tracking-widest" style={{color:theme.color}}>NAXA · Retrait auprès du partenaire</p><h1 className="mt-2 text-3xl font-black">{theme.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Consultez les produits disponibles, réservez auprès d’un partenaire et retirez votre commande sur place. Aucun paiement en ligne ni livraison n’est proposé ici.</p><p className="mt-3 text-sm font-bold">{products.length} produit(s) disponible(s)</p></section>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map((p)=>{const stock=Math.max(0,Math.floor(Number(p.available_quantity)));return <article key={p.product_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex h-44 items-center justify-center bg-slate-50">{p.photo_url?<img src={p.photo_url} alt={p.name} loading="lazy" className="h-full w-full object-contain"/>:<span className="text-5xl" aria-hidden="true">✳</span>}</div>
      <div className="space-y-2 p-4"><p className="text-xs font-bold uppercase tracking-wide" style={{color:theme.color}}>{p.category}</p><h2 className="text-lg font-extrabold">{p.name}</h2>{p.brand&&<p className="text-sm text-slate-600">{p.brand}</p>}{p.description&&<p className="text-sm leading-5 text-slate-600">{p.description}</p>}<p className="text-xs text-slate-500">Partenaire : {p.partner_name}</p><div className="flex items-baseline justify-between gap-2"><strong className="text-lg">{fcfa(Number(p.price_fcfa))}</strong><span className="text-xs font-semibold text-emerald-800">{stock} disponible(s)</span></div>
      <form action={reserverProduit} className="border-t pt-3"><input type="hidden" name="universe_slug" value={universe}/><input type="hidden" name="partner_id" value={p.partner_id}/><input type="hidden" name="product_id" value={p.product_id}/><label className="block text-sm font-semibold">Quantité<select name="quantity" defaultValue="1" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3" aria-label={"Quantité pour "+p.name}>{Array.from({length:Math.min(10,stock)},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label><button className="mt-3 min-h-11 w-full rounded-xl px-4 py-2 font-bold text-white" style={{backgroundColor:theme.color}}>Réserver pour retrait</button></form></div>
    </article>})}</div>
    <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">Les disponibilités sont calculées en tenant compte des réservations en cours. La réservation ne constitue pas un paiement. Vérifiez le statut avant de vous déplacer.</p>
  </div></main>;
}
