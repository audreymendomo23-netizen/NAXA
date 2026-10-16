"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { ArrowLeft, Heart, Search, Trash2 } from "lucide-react";
import { ecouterFavoris, ecrireFavoris, lireFavoris, type FavoriNAXA } from "@/lib/favoris-client";

function VisuelProduit({ item }: { item: FavoriNAXA }) {
  if (item.photo_url) {
    return <Image src={item.photo_url} alt={item.nom} width={100} height={100} unoptimized className="h-24 w-full object-contain" />;
  }
  return <div className="flex h-24 items-center justify-center rounded-2xl bg-[#E6F2EB]" aria-hidden="true">
    <svg viewBox="0 0 100 82" className="h-20 w-24">
      <g transform="translate(14 9) rotate(-8 36 30)">
        <rect x="12" y="4" width="62" height="54" rx="8" fill="#FFE23D" stroke="#D9BE31" />
        <rect x="4" y="12" width="62" height="54" rx="8" fill="#D8DEE0" stroke="#AAB5B8" strokeWidth="1.5" />
        {[0,1,2].map(row => [0,1,2].map(col => <ellipse key={row+"-"+col} cx={17+col*18} cy={23+row*14} rx="6" ry="4.5" fill="#FFFFFF" stroke="#AAB5B8" strokeWidth="1"/>))}
      </g>
    </svg>
  </div>;
}

export default function FavorisClientPage() {
  const reducedMotion = useReducedMotion();
  const [favoris, setFavoris] = useState<FavoriNAXA[]>([]);
  useEffect(() => {
    const actualiser = () => setFavoris(lireFavoris());
    actualiser();
    return ecouterFavoris(actualiser);
  }, []);

  const retirer = (id: string) => {
    const suivants = favoris.filter(item => item.id !== id);
    ecrireFavoris(suivants);
    setFavoris(suivants);
  };

  const entree = reducedMotion ? {} : {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.24, ease: "easeOut" as const },
  };

  return <LazyMotion features={domAnimation}><main className="min-h-dvh bg-[#F4F8F5] px-4 pb-[calc(100px+env(safe-area-inset-bottom,0px))] text-[#0B3D26]">
    <header className="-mx-4 bg-[#0F6B3F] px-4 pb-7 pt-[max(18px,env(safe-area-inset-top,0px))] text-white">
      <div className="mx-auto flex max-w-[480px] items-center gap-3">
        <Link href="/" aria-label="Retour à l’accueil" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><ArrowLeft size={21}/></Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white/75">Mon espace NAXA</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Mes favoris</h1>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0B542F] text-[#FFE23D]"><Heart size={22} fill="currentColor"/></span>
      </div>
    </header>

    <section className="mx-auto -mt-4 max-w-[480px]">
      <m.div {...entree} className="mb-4 rounded-2xl border border-[#D8E5DC] bg-white p-4 shadow-sm">
        <p className="text-sm leading-5 text-[#53685C]">Retrouvez ici les médicaments que vous avez enregistrés depuis l’accueil. Les prix et stocks doivent toujours être confirmés auprès de la pharmacie.</p>
        <p className="mt-2 text-sm font-extrabold">{favoris.length} favori{favoris.length === 1 ? "" : "s"}</p>
      </m.div>

      {favoris.length === 0 ? <m.div {...entree} className="rounded-[24px] border border-dashed border-[#B9D2C2] bg-white px-6 py-10 text-center shadow-sm">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E6F2EB] text-[#0F6B3F]"><Heart size={28}/></span>
        <h2 className="mt-4 text-lg font-extrabold">Votre liste est encore vide</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-5 text-[#64776B]">Touchez le cœur d’un médicament sur l’accueil pour le garder ici et le retrouver plus tard.</p>
        <Link href="/" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#FFE23D] px-5 text-sm font-extrabold text-[#0B3D26] shadow-sm transition-transform active:scale-[0.98]"><Search size={17}/> Découvrir les médicaments</Link>
      </m.div> : <div className="grid grid-cols-2 gap-3">
        {favoris.map((item, index) => <m.article key={item.id} {...(reducedMotion ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25, delay: Math.min(index * 0.05, 0.25) } })} className="relative flex min-w-0 flex-col rounded-[20px] bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.07)]">
          <Link href={item.demo ? "/resultats?q="+encodeURIComponent(item.nom) : "/produit/"+encodeURIComponent(item.id)} aria-label={`Consulter ${item.nom}`} className="flex min-h-24 items-center justify-center rounded-2xl">
            <VisuelProduit item={item}/>
          </Link>
          <button type="button" onClick={() => retirer(item.id)} aria-label={`Retirer ${item.nom} des favoris`} className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E5DC] bg-white text-[#0F6B3F] shadow-sm transition-transform active:scale-95">
            <Heart size={19} fill="currentColor" aria-hidden="true"/>
          </button>
          {item.demo && <span className="mt-2 w-fit rounded-full bg-[#FFF3B0] px-2 py-1 text-[11px] font-extrabold">Exemple</span>}
          <h2 className="mt-2 line-clamp-2 min-h-10 text-sm font-extrabold leading-5">{item.nom}</h2>
          <p className="mt-1 line-clamp-1 text-xs text-[#64776B]">{item.dosage || "Dosage non précisé"}</p>
          <p className="mt-2 text-base font-extrabold">{item.prix > 0 ? new Intl.NumberFormat("fr-FR").format(item.prix) + " FCFA" : "Prix à confirmer"}</p>
          <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-[#64776B]">{item.pharmacie}</p>
          <div className="mt-auto flex items-center gap-2 pt-3">
            <Link href={item.demo ? "/resultats?q="+encodeURIComponent(item.nom) : "/produit/"+encodeURIComponent(item.id)} className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[#FFE23D] px-2 text-xs font-extrabold">Voir le produit</Link>
            <button type="button" onClick={() => retirer(item.id)} aria-label={`Supprimer ${item.nom}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F8F5] text-[#0F6B3F]"><Trash2 size={17}/></button>
          </div>
        </m.article>)}
      </div>}
    </section>
  </main></LazyMotion>;
}
