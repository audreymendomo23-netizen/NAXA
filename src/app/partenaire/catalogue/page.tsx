import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { CsvCatalogueTools } from "./CsvCatalogueTools";
import { ajusterStockCatalogue, changerEtatProduitCatalogue, creerProduitCatalogue } from "./actions";

const field = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
const universeNames: Record<string, string> = { "parapharmacie": "Parapharmacie", "bebe-maman": "Bébé & Maman" };
const statusNames: Record<string, string> = { draft: "Brouillon", active: "Publié", archived: "Archivé" };
const movementNames: Record<string, string> = { opening: "Stock initial", receipt: "Réception", sale: "Retrait client", return: "Retour", adjustment: "Ajustement", loss: "Perte", transfer_in: "Transfert entrant", transfer_out: "Transfert sortant" };

export default async function CataloguePartenaire({ searchParams }: { searchParams: { ok?: string; erreur?: string } }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/partenaire/catalogue");
  const { data: memberships, error: membershipError } = await sb.from("partner_members")
    .select("partner_id,member_role,partners!inner(id,name,status)")
    .eq("user_id", auth.user.id).in("member_role", ["owner", "manager", "operator"]);
  if (membershipError || !memberships?.length) redirect("/");
  const active = (memberships as any[]).filter((m) => m.partners?.status === "active");
  if (!active.length) redirect("/");
  const ids = active.map((m) => m.partner_id);
  const [productsResult, movementsResult, associationsResult] = await Promise.all([
    sb.from("partner_products").select("id,partner_id,universe_slug,name,category,price_fcfa,stock_quantity,status,updated_at,expires_at")
      .in("partner_id", ids).order("updated_at", { ascending: false }).limit(200),
    sb.from("stock_movements").select("id,partner_id,product_id,quantity_delta,movement_type,reason,created_at")
      .in("partner_id", ids).order("created_at", { ascending: false }).limit(80),
    sb.from("partner_universes").select("partner_id,universe_slug,enabled").in("partner_id", ids),
  ]);
  const products = productsResult.data ?? [];
  const movements = movementsResult.data ?? [];
  const associations = associationsResult.data ?? [];
  const broken = !!(productsResult.error || movementsResult.error || associationsResult.error);
  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900"><div className="mx-auto max-w-6xl space-y-5 pt-4">
    <header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3 text-white sm:mx-0 sm:rounded-2xl"><Logo taille={32}/><Link href="/" className="font-bold underline">← Accueil</Link></header>
    <div><p className="text-xs font-extrabold uppercase tracking-widest text-teal-800">NAXA · Espace partenaire</p><h1 className="mt-1 text-3xl font-black">Catalogue et stocks</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Les nouveaux produits sont enregistrés en brouillon. Les mouvements de stock sont conservés dans un journal, et le stock ne peut pas devenir négatif.</p></div>
    {searchParams.ok && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{searchParams.ok === "creation" ? "Produit enregistré en brouillon." : searchParams.ok === "stock" ? "Stock et journal mis à jour." : "Statut du produit mis à jour."}</p>}
    {searchParams.erreur && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{searchParams.erreur === "univers" ? "Cet univers n’est pas activé pour ce partenaire." : searchParams.erreur === "stock" ? "Mouvement refusé : vérifiez le produit, la quantité et le stock disponible." : "Action impossible : vérifiez les champs et les droits du compte."}</p>}
    {broken && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Les tables de catalogue ou le journal ne sont pas disponibles. La migration 104 doit être appliquée après les migrations 098 à 103. Aucun changement n’est effectué par cet affichage.</div>}
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-extrabold">Ajouter un produit</h2><form action={creerProduitCatalogue} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Partenaire<select className={field} name="partner_id" required>{active.map((m: any) => <option key={m.partner_id} value={m.partner_id}>{m.partners.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Univers<select className={field} name="universe_slug" required><option value="parapharmacie">Parapharmacie</option><option value="bebe-maman">Bébé & Maman</option></select></label>
      <label className="text-sm font-semibold">Nom du produit<input className={field} name="name" minLength={2} maxLength={180} required/></label>
      <label className="text-sm font-semibold">Marque<input className={field} name="brand" maxLength={120}/></label>
      <label className="text-sm font-semibold">Catégorie<input className={field} name="category" maxLength={100} defaultValue="Autres"/></label>
      <label className="text-sm font-semibold">Prix (FCFA)<input className={field} name="price_fcfa" type="number" min="0" step="1" required/></label>
      <label className="text-sm font-semibold">Stock initial<input className={field} name="stock_quantity" type="number" min="0" max="1000000" step="0.001" required/></label>
      <label className="text-sm font-semibold">Unité<input className={field} name="unit_label" maxLength={30} defaultValue="unité"/></label>
      <label className="text-sm font-semibold sm:col-span-2">Photo (URL HTTPS)<input className={field} name="photo_url" type="url" placeholder="https://…"/></label>
      <label className="text-sm font-semibold sm:col-span-2">Description<textarea className={field} name="description" maxLength={600} rows={3}/></label>
      <button className="min-h-11 rounded-xl bg-[#064B2A] px-4 py-3 font-bold text-white sm:col-span-2">Enregistrer en brouillon</button>
    </form></section>
    <CsvCatalogueTools partnerOptions={active.map((m: any) => ({ id: m.partner_id, name: m.partners.name, universes: associations.filter((a: any) => a.partner_id === m.partner_id && a.enabled).map((a: any) => a.universe_slug).filter((u: string) => ["parapharmacie", "bebe-maman"].includes(u)) }))} />
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-extrabold">Mes produits</h2><div className="mt-4 space-y-3">{products.length ? products.map((product: any) => {const partner = active.find((m: any) => m.partner_id === product.partner_id);const canPublish = associations.some((a: any) => a.partner_id === product.partner_id && a.universe_slug === product.universe_slug && a.enabled);return <article key={product.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{product.name}</h3><p className="mt-1 text-sm text-slate-600">{partner?.partners?.name} · {universeNames[product.universe_slug] ?? product.universe_slug} · {product.price_fcfa.toLocaleString("fr-FR")} FCFA</p><p className="mt-1 text-sm">Stock physique : <strong>{product.stock_quantity}</strong> {product.unit_label ?? "unité"} · {statusNames[product.status] ?? product.status}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{product.category}</span></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2"><form action={ajusterStockCatalogue} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3"><input type="hidden" name="partner_id" value={product.partner_id}/><input type="hidden" name="product_id" value={product.id}/><label className="col-span-2 text-sm font-semibold">Mouvement de stock<input className={field} name="quantity_delta" type="number" step="0.001" required placeholder="+10 ou -2"/></label><label className="col-span-2 text-sm font-semibold">Type<select className={field} name="movement_type"><option value="receipt">Réception</option><option value="adjustment">Ajustement d’inventaire</option><option value="loss">Perte</option><option value="return">Retour</option><option value="transfer_in">Transfert entrant</option><option value="transfer_out">Transfert sortant</option><option value="opening">Stock initial</option></select></label><label className="col-span-2 text-sm font-semibold">Motif<input className={field} name="reason" maxLength={240}/></label><button className="col-span-2 min-h-10 rounded-lg bg-teal-800 px-3 py-2 text-sm font-bold text-white">Enregistrer le mouvement</button></form>
      <form action={changerEtatProduitCatalogue} className="flex flex-col justify-center gap-2 rounded-lg bg-slate-50 p-3"><input type="hidden" name="partner_id" value={product.partner_id}/><input type="hidden" name="product_id" value={product.id}/><label className="text-sm font-semibold">Visibilité<select className={field} name="status" defaultValue={product.status}><option value="draft">Brouillon</option><option value="active" disabled={!canPublish}>Publier</option><option value="archived">Archiver</option></select></label><button className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold">Enregistrer le statut</button></form></div>
      {product.expires_at && <p className="mt-2 text-xs text-amber-800">Date d’expiration : {product.expires_at}</p>}</article>}) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucun produit à afficher pour vos partenaires actifs.</p>}</div></section>
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-extrabold">Journal récent des stocks</h2><p className="mt-1 text-sm text-slate-600">Historique append-only : aucun mouvement n’est modifiable ou supprimable depuis cet espace.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-slate-600"><th className="p-2">Date</th><th className="p-2">Produit</th><th className="p-2">Mouvement</th><th className="p-2">Variation</th><th className="p-2">Motif</th></tr></thead><tbody>{movements.map((move: any) => <tr key={move.id} className="border-b last:border-0"><td className="p-2">{new Date(move.created_at).toLocaleString("fr-FR")}</td><td className="p-2">{products.find((p: any) => p.id === move.product_id)?.name ?? "Produit archivé"}</td><td className="p-2">{movementNames[move.movement_type] ?? move.movement_type}</td><td className="p-2 font-bold">{move.quantity_delta > 0 ? "+" : ""}{move.quantity_delta}</td><td className="p-2">{move.reason ?? "—"}</td></tr>)}</tbody></table>{!movements.length && <p className="p-3 text-sm text-slate-500">Aucun mouvement récent.</p>}</div></section>
  </div></main>;
}
