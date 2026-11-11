"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePanier } from "@/lib/panier";
import { reserverGroupeProduits } from "@/app/univers-actions";
import { excludedFromBabyUniverse, isMedicationProduct } from "@/lib/universe-product-rules";

const CART_KEY = "naxa-universe-cart-v1";
type Product = { product_id: string; partner_id: string | null; pharmacie_id: string | null; partner_name: string; universe_slug: string; name: string; brand: string | null; category: string; description: string | null; photo_url: string | null; price_fcfa: number; available_quantity: number; unit_label: string };
type Line = { productId: string; partnerId: string; partnerName: string; universe: string; name: string; price: number; quantity: number; maxQuantity: number };

function UniverseProductImage({ product, universe }: { product: Product; universe: "parapharmacie" | "bebe-maman" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.photo_url]);
  const baby = universe === "bebe-maman";
  const imageStyle = baby
    ? { backgroundImage: "linear-gradient(135deg, #FDEEF4 0%, #FFFFFF 56%, #FFF6E8 100%)" }
    : { backgroundImage: "linear-gradient(135deg, #E6F7F6 0%, #FFFFFF 56%, #EFFAF4 100%)" };
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden" style={imageStyle}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/70"
      />
      <span
        aria-hidden="true"
        className={baby
          ? "pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-rose-100/50"
          : "pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-teal-100/60"}
      />
      {product.photo_url && !failed ? (
        <img
          src={product.photo_url}
          alt={"Photo de " + product.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="relative z-10 h-full w-full object-contain p-3 sm:p-4"
        />
      ) : (
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 text-slate-400">
          <span
            className={baby ? "text-5xl font-light text-rose-300" : "text-5xl font-light text-teal-300"}
            aria-hidden="true"
          >
            {baby ? "♡" : "✳"}
          </span>
          <span className="text-[10px] font-semibold">{failed ? "Photo non chargée" : "Photo indisponible"}</span>
        </div>
      )}
    </div>
  );
}

export function UniverseProductGrid({ products, universe }: { products: Product[]; universe: "parapharmacie" | "bebe-maman" }) {
  const { ajouter: ajouterAuPanierPrincipal, lignes: panierPrincipal } = usePanier();
  const panierBebeMaman = panierPrincipal.filter(line => line.type_article === "bebe-maman");
  const nombreBebeMaman = panierBebeMaman.reduce((sum, line) => sum + line.quantite, 0);
  const [cart, setCart] = useState<Line[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes les catégories");
  const [sort, setSort] = useState(universe === "bebe-maman" ? "name" : "recommended");

  useEffect(() => {
    if (universe === "parapharmacie") {
      try {
        const raw = window.localStorage.getItem(CART_KEY);
        if (raw) {
          const value = JSON.parse(raw);
          if (Array.isArray(value)) setCart(value.filter(x =>
            x && typeof x.productId === "string" && typeof x.partnerId === "string"
            && x.universe === "parapharmacie" && Number.isInteger(x.quantity)
            && x.quantity > 0 && x.quantity <= 10
          ));
        }
      } catch {
        // Un panier partenaire illisible ne bloque pas le catalogue.
      }
    } else {
      setCart([]);
    }
    setReady(true);
  }, [universe]);

  useEffect(() => {
    if (ready && universe === "parapharmacie") {
      try { window.localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
      catch { /* Stockage local facultatif. */ }
    }
  }, [cart, ready, universe]);
const eligibleProducts = useMemo(() => products.filter(p => {
    if (universe === "bebe-maman") return !excludedFromBabyUniverse(p);
    return !isMedicationProduct(p);
  }), [products, universe]);
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

  const [cartError, setCartError] = useState("");
  const add = (p: Product) => {
    const max = Math.min(10, Math.floor(Number(p.available_quantity)));
    if (max < 1) return;
    if (universe === "bebe-maman") {
      if (!p.pharmacie_id) {
        setCartError("La pharmacie propriétaire de cet article n’est pas identifiée. Ajout impossible.");
        return;
      }
      const ok = ajouterAuPanierPrincipal({
        produit_id: "bebe-maman:" + p.product_id,
        nom: p.name,
        dosage: "",
        type_article: "bebe-maman",
        universe_product_id: p.product_id,
        pharmacie_id: p.pharmacie_id,
        pharmacie_nom: p.partner_name,
        prix_unitaire_fcfa: Number(p.price_fcfa),
        photo_url: p.photo_url,
      });
      setCartError(ok ? "" : "Le panier est plein ou la quantité maximale est déjà atteinte.");
      return;
    }
    if (!p.partner_id) return;
    setCart(old => {
      const found = old.find(x => x.productId === p.product_id);
      return found
        ? old.map(x => x.productId === p.product_id ? { ...x, maxQuantity: max, quantity: Math.min(max, x.quantity + 1) } : x)
        : [...old, { productId: p.product_id, partnerId: p.partner_id!, partnerName: p.partner_name, universe: "parapharmacie", name: p.name, price: Number(p.price_fcfa), quantity: 1, maxQuantity: max }];
    });
  };
  const change = (id: string, n: number) => setCart(old => old.map(x => x.productId === id ? { ...x, quantity: Math.max(1, Math.min(x.maxQuantity, n)) } : x));
  const remove = (id: string) => setCart(old => old.filter(x => x.productId !== id));
  const money = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";
  const palette = universe === "bebe-maman"
    ? {
        accent: "#C93774",
        soft: "#FDEEF4",
        border: "#F7CADC",
        priceSurface: "#FBF5F7",
        text: "#8F2455",
        shadow: "0 8px 24px rgba(148,70,103,0.08)",
      }
    : {
        accent: "#0B7F85",
        soft: "#E6F7F6",
        border: "#BFE6E4",
        priceSurface: "#F1FAFA",
        text: "#075E63",
        shadow: "0 8px 24px rgba(11,127,133,0.08)",
      };

  return <div>
    <section
      className="mb-5 rounded-3xl border bg-white p-4 shadow-sm sm:p-5"
      style={{ borderColor: palette.border }}
      aria-label="Filtres du catalogue"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <label htmlFor="universe-search" className="mb-2 block text-sm font-bold text-slate-800">
            {universe === "bebe-maman" ? "Rechercher (facultatif)" : "Rechercher un produit"}
          </label>
          <input
            id="universe-search"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nom, marque, catégorie ou partenaire…"
            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div>
          <label htmlFor="universe-sort" className="mb-2 block text-sm font-bold text-slate-800">Ordre d’affichage</label>
          <select
            id="universe-sort"
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
          >
            {universe !== "bebe-maman" && <option value="recommended">Ordre du catalogue</option>}
            <option value="name">Nom A à Z</option>
            {universe !== "bebe-maman" && <>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
            </>}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-800">Catégories</p>
          <span className="text-xs text-slate-500">{categories.length - 1} catégorie(s)</span>
        </div>
        <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1" role="group" aria-label="Filtrer par catégorie">
          {categories.map(c => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={category === c
                ? "shrink-0 whitespace-nowrap rounded-full border border-transparent px-3.5 py-2.5 text-xs font-bold text-white shadow-sm"
                : "shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-300"}
              style={category === c ? { backgroundColor: palette.accent } : undefined}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500" aria-live="polite">
          {visibleProducts.length} produit(s) affiché(s) sur {eligibleProducts.length} référence(s) disponible(s).
        </p>
        {universe === "bebe-maman" && (
          <p className="text-xs leading-5 text-slate-600">
            Présentation neutre : informations descriptives, prix et disponibilité. Aucun produit sponsorisé, classement publicitaire ni avantage promotionnel.
          </p>
        )}
      </div>
    </section>

    {visibleProducts.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-bold">{eligibleProducts.length === 0 ? "Aucun produit n’est actuellement publié dans cet univers." : "Aucun produit ne correspond à votre recherche."}</p>
      <p className="mt-1 text-sm text-slate-600">{eligibleProducts.length === 0 ? "Les articles apparaîtront ici lorsque {universe === "bebe-maman" ? "les pharmacies auront publié" : "les professionnels Parapharmacie auront publié"} leurs références avec leur prix et leur disponibilité." : "Modifiez le mot-clé ou choisissez une autre catégorie."}</p>
      {(query || category !== "Toutes les catégories" || sort !== (universe === "bebe-maman" ? "name" : "recommended")) && (
        <button
          type="button"
          onClick={() => { setQuery(""); setCategory("Toutes les catégories"); setSort(universe === "bebe-maman" ? "name" : "recommended"); }}
          className="mt-4 min-h-11 rounded-xl px-4 font-bold text-white"
          style={{ backgroundColor: palette.accent }}
        >
          Effacer les filtres
        </button>
      )}
    </div> :
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {visibleProducts.map(p => {
          const stock = Math.max(0, Math.floor(Number(p.available_quantity)));
          const selected = universe === "bebe-maman"
            ? panierBebeMaman.find(line => line.universe_product_id === p.product_id)
            : cart.find(x => x.productId === p.product_id);
          return (
            <article
              key={p.product_id}
              className="group min-w-0 overflow-hidden rounded-3xl border bg-white shadow-sm transition-shadow hover:shadow-md"
              style={{ borderColor: palette.border, boxShadow: palette.shadow }}
            >
              <UniverseProductImage product={p} universe={universe}/>
              <div className="space-y-2.5 p-3 sm:p-4">
                <p
                  className="inline-flex max-w-full rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: palette.soft, color: palette.text }}
                  title={p.category}
                >
                  <span className="truncate">{p.category}</span>
                </p>
                <h2 className="line-clamp-2 min-h-12 text-sm font-extrabold leading-5 text-slate-900 sm:text-base">
                  {p.name}
                </h2>
                {p.brand && <p className="truncate text-xs font-medium text-slate-600">{p.brand}</p>}
                {p.description && (
                  <p className="line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-slate-600">{p.description}</p>
                )}
                <p className="truncate text-[10px] text-slate-500">{universe === "bebe-maman" ? "Pharmacie" : "Professionnel Parapharmacie"} : {p.partner_name}</p>
                <div className="rounded-xl p-2.5" style={{ backgroundColor: palette.priceSurface }}>
                  <p className="mb-1 text-[10px] font-semibold text-slate-500">Prix renseigné par {universe === "bebe-maman" ? "la pharmacie" : "le professionnel"}</p>
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <strong className="text-sm font-black text-slate-900">{money(Number(p.price_fcfa))}</strong>
                    <span className={stock > 0 ? "text-[10px] font-semibold text-emerald-800" : "text-[10px] font-semibold text-red-700"}>
                      {stock} disponible(s)
                    </span>
                  </div>
                </div>
                {cartError && universe === "bebe-maman" && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{cartError}</p>}
                <button
                  type="button"
                  onClick={() => add(p)}
                  disabled={stock < 1 || (universe === "bebe-maman" && !p.pharmacie_id)}
                  className="mt-1 min-h-11 w-full rounded-xl px-2 py-2 text-xs font-bold text-white transition hover:brightness-95 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: palette.accent }}
                >
                  {stock < 1 ? "Indisponible" : universe === "bebe-maman" && !p.pharmacie_id ? "Pharmacie non identifiée" : selected ? "Ajouter un autre" : "Ajouter au panier"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    }
    {universe === "bebe-maman" ? (
      <section className="mt-7 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold">Panier principal NAXA</h2>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-800">{nombreBebeMaman} article(s)</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">Les articles Bébé &amp; Maman rejoignent le même panier que les médicaments. Les demandes seront regroupées par pharmacie.</p>
        <Link href="/panier" className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-[#C93774] px-4 py-2 text-sm font-bold text-white">
          Ouvrir mon panier principal
        </Link>
      </section>
    ) : (
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Panier Parapharmacie</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{cart.reduce((n, x) => n + x.quantity, 0)} article(s)</span></div><p className="mt-1 text-sm text-slate-600">Panier Parapharmacie conservé sur cet appareil. Les réservations restent regroupées par partenaire pour garantir le retrait au bon endroit.</p>
      {!ready ? <p className="mt-4 text-sm text-slate-500">Chargement du panier…</p> : cart.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Ajoutez un produit pour préparer une réservation.</p> : <div className="mt-4 space-y-4">{groups.map(g => {
        const first = g.lines[0]; const total = g.lines.reduce((s, x) => s + x.price * x.quantity, 0);
        return <section key={g.key} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-extrabold">{first.partnerName}</h3><p className="text-xs text-slate-500">{first.universe === "bebe-maman" ? "Bébé & Maman" : "Parapharmacie"}</p></div><strong>{money(total)}</strong></div><ul className="mt-3 space-y-3">{g.lines.map(x => <li key={x.productId} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div className="min-w-0 flex-1"><p className="font-semibold">{x.name}</p><p className="text-xs text-slate-500">{money(x.price)} l’unité</p></div><div className="flex items-center gap-2"><button type="button" aria-label={"Diminuer " + x.name} onClick={() => change(x.productId, x.quantity - 1)} disabled={x.quantity <= 1} className="h-9 w-9 rounded-lg border disabled:opacity-40">−</button><span className="w-5 text-center font-bold">{x.quantity}</span><button type="button" aria-label={"Augmenter " + x.name} onClick={() => change(x.productId, x.quantity + 1)} disabled={x.quantity >= x.maxQuantity} className="h-9 w-9 rounded-lg border disabled:opacity-40">+</button><button type="button" onClick={() => remove(x.productId)} className="ml-1 text-xs font-bold text-red-700 underline">Retirer</button></div></li>)}</ul><form action={reserverGroupeProduits} className="mt-4"><input type="hidden" name="partner_id" value={first.partnerId} /><input type="hidden" name="universe_slug" value={first.universe} /><input type="hidden" name="items" value={JSON.stringify(g.lines.map(x => ({ product_id: x.productId, quantity: x.quantity })))} /><button className="min-h-11 w-full rounded-xl bg-[#064B2A] px-4 py-2 font-bold text-white">Réserver ce groupe pour retrait</button></form></section>;
      })}</div>}
    </section>
    )}
  </div>;
}
