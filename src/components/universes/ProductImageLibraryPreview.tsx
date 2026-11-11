"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LibraryItem = {
  code: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  photographer: string;
  sourceUrl: string;
};
type Galleries = {
  parapharmacie: LibraryItem[];
  bebeMaman: LibraryItem[];
};

const emptyGalleries: Galleries = { parapharmacie: [], bebeMaman: [] };

function ImageCard({ item, accent }: { item: LibraryItem; accent: string }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex aspect-[4/3] items-center justify-center p-3" style={{ backgroundColor: accent + "14" }}>
        <img
          src={item.imageUrl}
          alt={"Photo de référence : " + item.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
        />
      </div>
      <div className="p-3">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.brand}</p>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-xs font-extrabold leading-5 text-slate-900">{item.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 text-slate-500">{item.category}</p>
        <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">Crédit : {item.photographer}</p>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center text-[11px] font-bold underline underline-offset-2" style={{ color: accent }}>
          Fiche source
        </a>
      </div>
    </article>
  );
}

export function ProductImageLibraryPreview() {
  const [galleries, setGalleries] = useState<Galleries>(emptyGalleries);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetch("/api/bibliotheque-images", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error("Bibliothèque temporairement indisponible.");
      return response.json() as Promise<{ galleries?: Galleries }>;
    }).then(payload => {
      if (active && payload.galleries) setGalleries({
        parapharmacie: Array.isArray(payload.galleries.parapharmacie) ? payload.galleries.parapharmacie : [],
        bebeMaman: Array.isArray(payload.galleries.bebeMaman) ? payload.galleries.bebeMaman : [],
      } as unknown as Galleries);
    }).catch(() => {
      // L’accueil principal reste utilisable même si la base d’images externe est indisponible.
    }).finally(() => {
      if (active) setLoaded(true);
    });
    return () => { active = false; controller.abort(); };
  }, []);

  const sections = [
    { key: "parapharmacie" as const, title: "Parapharmacie", description: "Hygiène, soin et cosmétique", accent: "#0B7F85", href: "/parapharmacie", items: galleries.parapharmacie },
    { key: "bebeMaman" as const, title: "Bébé & Maman", description: "Références informatives maman et petite enfance", accent: "#C93774", href: "/bebe-maman", items: galleries.bebeMaman },
  ].filter(section => section.items.length > 0);

  if (!loaded && sections.length === 0) {
    return (
      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Chargement de la bibliothèque visuelle">
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100"/>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[0,1].map(i => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-100"/>)}
        </div>
      </section>
    );
  }
  if (sections.length === 0) return null;

  return (
    <section className="mb-6 space-y-5" aria-labelledby="main-image-library-title">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#0F6B3F]">Photos de référence · Base ouverte</p>
        <h2 id="main-image-library-title" className="mt-1 text-[21px] font-extrabold tracking-[-0.03em] text-[#0B3D26]">Bibliothèque visuelle des produits</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">Images documentaires, sans prix, sans classement commercial et sans indication de stock. Elles ne correspondent pas nécessairement aux articles proposés par une pharmacie proche.</p>
      </div>

      {sections.map(section => (
        <div key={section.key} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">{section.title}</h3>
              <p className="text-[11px] text-slate-500">{section.description}</p>
            </div>
            <Link href={section.href} className="shrink-0 text-[11px] font-bold underline underline-offset-2" style={{ color: section.accent }}>
              Ouvrir l’espace
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {section.items.slice(0, 4).map(item => <ImageCard key={item.code} item={item} accent={section.accent}/>)}
          </div>
        </div>
      ))}

      <p className="text-[10px] leading-5 text-slate-500">
        Photos contributives Open Beauty Facts · CC BY-SA 3.0. Les fiches sources et crédits restent accessibles sur chaque référence. Les visuels ne constituent ni une offre, ni un prix, ni une confirmation de disponibilité.
      </p>
    </section>
  );
}
