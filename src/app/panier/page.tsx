"use client";

import Link from "next/link";
import { IllustrationPageClient } from "@/components/IllustrationPageClient";
import { useRouter } from "next/navigation";
import { MAX_QTE, usePanier } from "@/lib/panier";

const money = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) + " FCFA";

export default function Panier() {
  const router = useRouter();
  const { lignes, pret, changerQuantite, retirer, vider } = usePanier();
  const bebeMaman = lignes.filter(line => line.type_article === "bebe-maman");
  const medicaments = lignes.filter(line => line.type_article !== "bebe-maman");
  const chercherPharmacies = () => {
    const params = new URLSearchParams();
    medicaments.forEach(line => params.append("p", `${line.produit_id}:${line.quantite}`));
    if (medicaments.length) router.push(`/resultats?${params.toString()}`);
  };
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
      <IllustrationPageClient src="/couvertures/panier-reservations.webp" alt="Illustration du panier et des réservations" titre="Mon panier" />
      <div className="mb-4 flex justify-end"><Link href="/client" className="text-sm font-semibold text-naxa-green-900 underline">Continuer mes achats</Link></div>
      <h1 className="text-2xl font-extrabold">Mon panier</h1>
      <p className="mt-1 text-sm text-slate-600">Médicaments et articles Bébé &amp; Maman sont réunis ici. Chaque demande conserve son circuit professionnel.</p>
      {!pret && <p>Chargement…</p>}
      {pret && lignes.length === 0 && <div className="carte mt-6"><p className="font-bold">Votre panier est vide.</p><Link href="/" className="btn btn-vert mt-4 w-full">Chercher un produit</Link></div>}
      {pret && bebeMaman.length > 0 && <section className="carte mt-6 border-rose-200">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold text-rose-800">Bébé &amp; Maman</h2><span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800">{bebeMaman.reduce((n,x)=>n+x.quantite,0)} article(s)</span></div>
        <p className="mt-1 text-sm text-slate-600">Les demandes sont adressées à la pharmacie qui gère chaque article.</p>
        <ul className="mt-4 space-y-3">{bebeMaman.map(line=><li key={line.produit_id} className="flex gap-3 border-t border-rose-100 pt-3">
          {line.photo_url ? <img src={line.photo_url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl bg-rose-50 object-contain p-1"/> : <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-2xl text-rose-300">♡</div>}
          <div className="min-w-0 flex-1"><p className="font-bold">{line.nom}</p><p className="mt-1 text-xs text-slate-500">{line.pharmacie_nom || "Pharmacie participante"}</p>{typeof line.prix_unitaire_fcfa==="number"&&<p className="mt-1 text-sm font-bold">{money(line.prix_unitaire_fcfa*line.quantite)}</p>}
            <div className="mt-2 flex items-center gap-2"><button className="btn btn-clair !px-0 h-9 w-9" onClick={()=>changerQuantite(line.produit_id,line.quantite-1)} disabled={line.quantite<=1}>−</button><output className="w-6 text-center font-extrabold">{line.quantite}</output><button className="btn btn-clair !px-0 h-9 w-9" onClick={()=>changerQuantite(line.produit_id,line.quantite+1)} disabled={line.quantite>=MAX_QTE}>+</button><button className="ml-2 text-sm font-semibold text-red-700 underline" onClick={()=>retirer(line.produit_id)}>Retirer</button></div>
          </div>
        </li>)}</ul>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Le transfert de ces articles vers les pharmacies sera activé après validation du parcours de réservation B&amp;M côté serveur. Aucun article ne sera envoyé par le circuit médicaments.</p>
      </section>}
      {pret && medicaments.length > 0 && <section className="mt-6"><h2 className="text-lg font-extrabold">Médicaments</h2><ul className="mt-3 space-y-3">{medicaments.map(line=><li key={line.produit_id} className="carte">
        <Link href={`/produit/${line.produit_id}`} className="font-bold underline">{line.nom}</Link>{line.dosage&&<p className="mt-1 text-sm text-slate-500">{line.dosage}</p>}
        <div className="mt-3 flex items-center justify-between"><div className="flex gap-2"><button className="btn btn-clair !px-0 w-12" onClick={()=>changerQuantite(line.produit_id,line.quantite-1)} disabled={line.quantite<=1}>−</button><output className="w-8 text-center text-xl font-extrabold">{line.quantite}</output><button className="btn btn-clair !px-0 w-12" onClick={()=>changerQuantite(line.produit_id,line.quantite+1)} disabled={line.quantite>=MAX_QTE}>+</button></div><button className="text-red-700 underline" onClick={()=>retirer(line.produit_id)}>Retirer</button></div>
      </li>)}</ul><button className="btn btn-vert mt-5 w-full" onClick={chercherPharmacies}>Trouver les pharmacies qui ont tout</button><Link href="/achats/credit" className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-[#0B3D26] bg-[#FFF3A6] px-4 py-3 text-center font-extrabold text-[#0B3D26]">Demander un achat à crédit</Link></section>}
      {pret && lignes.length > 0 && <button className="mt-6 min-h-[48px] w-full underline" onClick={vider}>Vider le panier</button>}
    </main>
  );
}
