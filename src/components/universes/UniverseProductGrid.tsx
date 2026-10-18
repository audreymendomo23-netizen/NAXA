"use client";

import { useEffect, useMemo, useState } from "react";
import { reserverGroupeProduits } from "@/app/univers-actions";

const CART_KEY = "naxa-universe-cart-v1";
type Product = { product_id: string; partner_id: string; partner_name: string; universe_slug: string; name: string; brand: string | null; category: string; description: string | null; photo_url: string | null; price_fcfa: number; available_quantity: number; unit_label: string };
type Line = { productId: string; partnerId: string; partnerName: string; universe: string; name: string; price: number; quantity: number; maxQuantity: number };

function excludedFromBabyUniverse(product: Product) {
  const text = [product.name, product.category, product.description ?? "", product.brand ?? ""].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(lait|laits|biberon|biberons|lait infantile|lait pour bebe|preparation pour nourrisson)\b/.test(text);
}

export function UniverseProductGrid({ products, universe }: { products: Product[]; universe: "parapharmacie" | "bebe-maman" }) {
  const [cart, setCart] = useState<Line[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes les catégories");
  const [sort, setSort] = useState("recommended");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      if (raw) {
        const value = JSON.parse(raw);
        if (Array.isArray(value)) setCart(value.filter(x => x && typeof x.productId === "string" && typeof x.partnerId === "string" && ["parapharmacie", "bebe-maman"].includes(x.universe) && Number.isInteger(x.quantity) && x.quantity > 0 && x.quantity <= 10));
      }
    } catch { /* Un panier local illisible ne doit pas bloquer le catalogue. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      try { window.localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* Stockage local facultatif. */ }
    }
  }, [cart, ready]);

  const eligibleProducts = useMemo(() => products.filter(p => universe !== "bebe-maman" || !excludedFromBabyUniverse(p)), [products, universe]);
  const categories = useMemo(() => ["Toutes les catégories", ...Array.from(new Set(eligibleProducts.map(p => p.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"))], [eligibleProducts]);
  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    const result = eligibleProducts.filter(p =>
      (category === "Toutes les catégories" || p.category === category) &&
      (!needle || [p.name, p.brand ?? "", p.category, p.description ?? "", p.partner_name].join(" ").toLocaleLowerCase("fr").includes(needle))
    );
    if (sort === "price-asc") result.sort((a, b) => a.price_fcfa - b.price_fcfa);
    if (sort === "price-desc") result.sort((a, b) => b.price_fcfa - a.price_fcfa);
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return result;
  }, [eligibleProducts, query, category, sort]);

  const groups = useMemo(() => {
    const map = new Map<string, Line[]>();
    for (const line of cart) {
      const key = line.partnerId + "|" + line.universe;
      map.set(key, [...(map.get(key) ?? []), line]);
    }
    return Array.from(map.entries()).map(([key, lines]) => ({ key, lines }));
  }, [cart]);

  const add = (p: Product) => {
    const max = Math.min(10, Math.floor(Number(p.available_quantity)));
    if (max < 1) return;
    setCart(old => {
      const found = old.find(x => x.productId === p.product_id);
      return found
        ? old.map(x => x.productId === p.product_id ? { ...x, maxQuantity: max, quantity: Math.min(max, x.quantity + 1) } : x)
        : [...old, { productId: p.product_id, partnerId: p.partner_id, partnerName: p.partner_name, universe: p.universe_slug, name: p.name, price: Number(p.price_fcfa), quantity: 1, maxQuantity: max }];
    });
  };
  const change = (id: string, n: number) => setCart(old => old.map(x => x.productId === id ? { ...x, quantity: Math.max(1, Math.min(x.maxQuantity, n)) } : x));
  const remove = (id: string) => setCart(old => old.filter(x => x.productId !== id));
  const money = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";
  const theme = universe === "bebe-maman" ? "#AD2D63" : "#096A6F";

  return <div>
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Filtres du catalogue">
      <label htmlFor="universe-search" className="mb-2 block text-sm font-bold text-slate-800">Rechercher un produit</label>
      <input id="universe-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, marque, catégorie ou partenaire…" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="universe-category" className="mb-1 block text-sm font-semibold">Catégorie</label><select id="universe-category" value={category} onChange={e => setCategory(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div><label htmlFor="universe-sort" className="mb-1 block text-sm font-semibold">Trier par</label><select id="universe-sort" value={sort} onChange={e => setSort(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="recommended">Recommandés</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option><option value="name">Nom A à Z</option></select></div>
      </div>
      <p className="mt-3 text-xs text-slate-500" aria-live="polite">{visibleProducts.length} produit(s) affiché(s) sur {eligibleProducts.length} disponible(s) dans le catalogue.</p>
      {universe === "bebe-maman" && <p className="mt-2 text-xs leading-5 text-slate-600">Cet espace est réservé aux articles de puériculture, de maternité et de soin. Le lait et les biberons sont exclus de cet univers.</p>}
    </section>

    {visibleProducts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-bold">Aucun produit ne correspond à votre recherche.</p><p className="mt-1 text-sm text-slate-600">Modifiez le mot-clé ou choisissez une autre catégorie.</p><button type="button" onClick={() => { setQuery(""); setCategory("Toutes les catégories"); setSort("recommended"); }} className="mt-4 min-h-11 rounded-xl px-4 font-bold text-white" style={{ backgroundColor: theme }}>Effacer les filtres</button></div> :
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map(p => {
        const stock = Math.max(0, Math.floor(Number(p.available_quantity)));
        const selected = cart.find(x => x.productId === p.product_id);
        return <article key={p.product_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex h-44 items-center justify-center bg-slate-50">{p.photo_url ? <img src={p.photo_url} alt={p.name} loading="lazy" className="h-full w-full object-contain" /> : <span className="text-5xl" aria-hidden="true">{universe === "bebe-maman" ? "♡" : "✳"}</span>}</div>
          <div className="space-y-2 p-4"><p className="text-xs font-bold uppercase tracking-wide" style={{ color: theme }}>{p.category}</p><h2 className="text-lg font-extrabold">{p.name}</h2>{p.brand && <p className="text-sm text-slate-600">{p.brand}</p>}{p.description && <p className="text-sm leading-5 text-slate-600">{p.description}</p>}<p className="text-xs text-slate-500">Partenaire : {p.partner_name}</p><div className="flex items-baseline justify-between gap-2"><strong className="text-lg">{money(Number(p.price_fcfa))}</strong><span className={stock > 0 ? "text-xs font-semibold text-emerald-800" : "text-xs font-semibold text-red-700"}>{stock} disponible(s)</span></div><button type="button" onClick={() => add(p)} disabled={stock < 1} className="mt-2 min-h-11 w-full rounded-xl px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: theme }}>{stock < 1 ? "Indisponible" : selected ? "Ajouter un autre" : "Ajouter au panier"}</button></div>
        </article>;
      })}</div>
    }

    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Mon panier multi-univers</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{cart.reduce((n, x) => n + x.quantity, 0)} article(s)</span></div><p className="mt-1 text-sm text-slate-600">Panier conservé sur cet appareil. Les réservations sont regroupées par partenaire et par univers pour garantir le retrait au bon endroit.</p>
      {!ready ? <p className="mt-4 text-sm text-slate-500">Chargement du panier…</p> : cart.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Ajoutez un produit pour préparer une réservation.</p> : <div className="mt-4 space-y-4">{groups.map(g => {
        const first = g.lines[0]; const total = g.lines.reduce((s, x) => s + x.price * x.quantity, 0);
        return <section key={g.key} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-extrabold">{first.partnerName}</h3><p className="text-xs text-slate-500">{first.universe === "bebe-maman" ? "Bébé & Maman" : "Parapharmacie"}</p></div><strong>{money(total)}</strong></div><ul className="mt-3 space-y-3">{g.lines.map(x => <li key={x.productId} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div className="min-w-0 flex-1"><p className="font-semibold">{x.name}</p><p className="text-xs text-slate-500">{money(x.price)} l’unité</p></div><div className="flex items-center gap-2"><button type="button" aria-label={"Diminuer " + x.name} onClick={() => change(x.productId, x.quantity - 1)} disabled={x.quantity <= 1} className="h-9 w-9 rounded-lg border disabled:opacity-40">−</button><span className="w-5 text-center font-bold">{x.quantity}</span><button type="button" aria-label={"Augmenter " + x.name} onClick={() => change(x.productId, x.quantity + 1)} disabled={x.quantity >= x.maxQuantity} className="h-9 w-9 rounded-lg border disabled:opacity-40">+</button><button type="button" onClick={() => remove(x.productId)} className="ml-1 text-xs font-bold text-red-700 underline">Retirer</button></div></li>)}</ul><form action={reserverGroupeProduits} className="mt-4"><input type="hidden" name="partner_id" value={first.partnerId} /><input type="hidden" name="universe_slug" value={first.universe} /><input type="hidden" name="items" value={JSON.stringify(g.lines.map(x => ({ product_id: x.productId, quantity: x.quantity })))} /><button className="min-h-11 w-full rounded-xl bg-[#064B2A] px-4 py-2 font-bold text-white">Réserver ce groupe pour retrait</button></form></section>;
      })}</div>}
    </section>
  </div>;
}
