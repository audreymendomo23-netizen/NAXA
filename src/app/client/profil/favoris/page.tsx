"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { IconeNAXA } from "@/components/IconeNAXA";
import { EnTeteClient } from "@/components/EnTeteClient";
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


  return <main className="min-h-dvh bg-[#F4F8F5] px-4 pb-[calc(100px+env(safe-area-inset-bottom,0px))] text-[#0B3D26]">
    <EnTeteClient/>

    <section className="mx-auto -mt-4 max-w-[480px]">
      <div className="naxa-enter mb-4 rounded-2xl border border-[#D8E5DC] bg-white p-4 shadow-sm">
        <p className="text-sm leading-5 text-[#53685C]">Retrouvez ici les médicaments que vous avez enregistrés depuis l’accueil. Les prix et stocks doivent toujours être confirmés auprès de la pharmacie.</p>
        <p className="mt-2 text-sm font-extrabold">{favoris.length} favori{favoris.length === 1 ? "" : "s"}</p>
      </div>

      {favoris.length === 0 ? <div className="naxa-enter rounded-[24px] border border-dashed border-[#B9D2C2] bg-white px-6 py-10 text-center shadow-sm">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E6F2EB] text-[#0F6B3F]"><IconeNAXA name="heart" size={28}/></span>
        <h2 className="mt-4 text-lg font-extrabold">Votre liste est encore vide</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-5 text-[#64776B]">Touchez le cœur d’un médicament sur l’accueil pour le garder ici et le retrouver plus tard.</p>
        <Link href="/" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#FFE23D] px-5 text-sm font-extrabold text-[#0B3D26] shadow-sm transition-transform active:scale-[0.98]"><IconeNAXA name="search" size={17}/> Découvrir les médicaments</Link>
      </div> : <div className="grid grid-cols-2 gap-3">
        {favoris.map((item, index) => <article key={item.id} style={{ animationDelay: `${Math.min(index * 50, 250)}ms` }} className="naxa-enter relative flex min-w-0 flex-col rounded-[20px] bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.07)]">
          <Link href={item.demo ? "/resultats?q="+encodeURIComponent(item.nom) : "/produit/"+encodeURIComponent(item.id)} aria-label={`Consulter ${item.nom}`} className="flex min-h-24 items-center justify-center rounded-2xl">
            <VisuelProduit item={item}/>
          </Link>
          <button type="button" onClick={() => retirer(item.id)} aria-label={`Retirer ${item.nom} des favoris`} className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E5DC] bg-white text-[#0F6B3F] shadow-sm transition-transform active:scale-95">
            <IconeNAXA name="heart" size={19} filled/>
          </button>
          {item.demo && <span className="mt-2 w-fit rounded-full bg-[#FFF3B0] px-2 py-1 text-[11px] font-extrabold">Exemple</span>}
          <h2 className="mt-2 line-clamp-2 min-h-10 text-sm font-extrabold leading-5">{item.nom}</h2>
          <p className="mt-1 line-clamp-1 text-xs text-[#64776B]">{item.dosage || "Dosage non précisé"}</p>
          <p className="mt-2 text-base font-extrabold">{item.prix > 0 ? new Intl.NumberFormat("fr-FR").format(item.prix) + " FCFA" : "Prix à confirmer"}</p>
          <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-[#64776B]">{item.pharmacie}</p>
          <div className="mt-auto flex items-center gap-2 pt-3">
            <Link href={item.demo ? "/resultats?q="+encodeURIComponent(item.nom) : "/produit/"+encodeURIComponent(item.id)} className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[#FFE23D] px-2 text-xs font-extrabold">Voir le produit</Link>
            <button type="button" onClick={() => retirer(item.id)} aria-label={`Supprimer ${item.nom}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F8F5] text-[#0F6B3F]"><IconeNAXA name="trash" size={17}/></button>
          </div>
        </article>)}
      </div>}
    </section>
  </main>;
}
