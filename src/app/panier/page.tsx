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
  const pharmacies = Array.from(medicaments.reduce((groups, line) => {
    const ownerId = line.pharmacie_id ?? (line.owner_type === "pharmacie" ? line.owner_id : undefined);
    if (!ownerId || (line.owner_type && line.owner_type !== "pharmacie")) return groups;
    const group = groups.get(ownerId) ?? [];
    group.push(line);
    groups.set(ownerId, group);
    return groups;
  }, new Map<string, typeof medicaments>()));
  const lignesSansPharmacie = medicaments.filter(line => {
    const ownerId = line.pharmacie_id ?? (line.owner_type === "pharmacie" ? line.owner_id : undefined);
    return !ownerId || (line.owner_type && line.owner_type !== "pharmacie");
  });
  const chercherPharmacies = () => {
    const params = new URLSearchParams();
    lignesSansPharmacie.filter(line => !line.owner_type || line.owner_type === "pharmacie")
      .forEach(line => params.append("p", `${line.produit_id}:${line.quantite}`));
    if (params.size) router.push(`/resultats?${params.toString()}`);
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
        <p className="mt-1 text-sm text-slate-600">Chaque demande est adressée à l’établissement qui détient réellement le stock.</p>
        <ul className="mt-4 space-y-3">{bebeMaman.map(line=><li key={line.produit_id + ":" + (line.owner_id ?? line.pharmacie_id ?? line.partner_id ?? "sans-proprietaire")} className="flex gap-3 border-t border-rose-100 pt-3">
          {line.photo_url ? <img src={line.photo_url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl bg-rose-50 object-contain p-1"/> : <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-2xl text-rose-300">♡</div>}
          <div className="min-w-0 flex-1"><p className="font-bold">{line.nom}</p><p className="mt-1 text-xs text-slate-500">{line.owner_type === "parapharmacie" || (!line.owner_type && line.partner_id) ? "Parapharmacie" : "Pharmacie"} · {line.pharmacie_nom || "Établissement participant"}</p>{typeof line.prix_unitaire_fcfa==="number"&&<p className="mt-1 text-sm font-bold">{money(line.prix_unitaire_fcfa*line.quantite)}</p>}
            <div className="mt-2 flex items-center gap-2"><button className="btn btn-clair !px-0 h-9 w-9" onClick={()=>changerQuantite(line.produit_id,line.quantite-1,{},line.owner_type??(line.pharmacie_id?"pharmacie":line.partner_id?"parapharmacie":undefined),line.owner_id??line.pharmacie_id??line.partner_id)} disabled={line.quantite<=1}>−</button><output className="w-6 text-center font-extrabold">{line.quantite}</output><button className="btn btn-clair !px-0 h-9 w-9" onClick={()=>changerQuantite(line.produit_id,line.quantite+1,{},line.owner_type??(line.pharmacie_id?"pharmacie":line.partner_id?"parapharmacie":undefined),line.owner_id??line.pharmacie_id??line.partner_id)} disabled={line.quantite>=Math.min(MAX_QTE,line.quantite_max ?? MAX_QTE)}>+</button><button className="ml-2 text-sm font-semibold text-red-700 underline" onClick={()=>retirer(line.produit_id,line.owner_type??(line.pharmacie_id?"pharmacie":line.partner_id?"parapharmacie":undefined),line.owner_id??line.pharmacie_id??line.partner_id)}>Retirer</button></div>
          </div>
        </li>)}</ul>
        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-900">Chaque établissement reçoit sa réservation dans son propre espace de gestion. Le stock est contrôlé et réservé par son moteur d’inventaire ; le paiement reste directement géré par le vendeur.</p>
        <Link href="/commande/bebe-maman" className="btn btn-vert mt-3 w-full">Finaliser les réservations Bébé &amp; Maman</Link>
      </section>}
      {pret && medicaments.length > 0 && <section className="mt-6 space-y-4">
        <h2 className="text-lg font-extrabold">Pharmacie · demandes séparées par établissement</h2>
        {pharmacies.map(([pharmacieId, items]) => <article key={pharmacieId} className="carte">
          <h3 className="font-extrabold">Pharmacie</h3>
          <p className="mt-1 text-xs text-slate-500">Cette liste sera transmise uniquement à la pharmacie propriétaire des articles.</p>
          <ul className="mt-3 space-y-3">{items.map(line=><li key={line.produit_id + ":" + (line.owner_id || pharmacieId)} className="border-t pt-3">
            <Link href={`/produit/${line.produit_id}`} className="font-bold underline">{line.nom}</Link>{line.dosage&&<p className="text-sm text-slate-500">{line.dosage}</p>}
            <div className="mt-2 flex items-center justify-between"><div className="flex gap-2">
              <button className="btn btn-clair !px-0 w-10" onClick={()=>changerQuantite(line.produit_id,line.quantite-1,{},line.owner_type,line.owner_id)} disabled={line.quantite<=1}>−</button>
              <output className="w-7 text-center font-bold">{line.quantite}</output>
              <button className="btn btn-clair !px-0 w-10" onClick={()=>changerQuantite(line.produit_id,line.quantite+1,{},line.owner_type,line.owner_id)} disabled={line.quantite>=(line.quantite_max??MAX_QTE)}>+</button>
            </div><button className="text-sm text-red-700 underline" onClick={()=>retirer(line.produit_id,line.owner_type,line.owner_id)}>Retirer</button></div>
          </li>)}</ul>
          <Link href={`/commande/nouvelle?pharmacie=${encodeURIComponent(pharmacieId)}`} className="btn btn-vert mt-4 w-full">Finaliser avec cette pharmacie</Link>
        </article>)}
        {lignesSansPharmacie.length > 0 && <article className="carte">
          <h3 className="font-bold">Articles sans pharmacie propriétaire confirmée</h3>
          <p className="mt-1 text-sm text-slate-600">Ils ne peuvent pas être envoyés à une pharmacie choisie arbitrairement. Recherchez une pharmacie qui détient les articles.</p>
          <ul className="mt-3 space-y-2">{lignesSansPharmacie.map(line=><li key={line.produit_id + ":" + (line.owner_id || "sans-proprietaire")} className="flex items-center justify-between gap-3 border-t pt-2">
            <span className="text-sm font-semibold">{line.nom} × {line.quantite}</span>
            <button className="text-sm text-red-700 underline" onClick={()=>retirer(line.produit_id,line.owner_type,line.owner_id)}>Retirer</button>
          </li>)}</ul>
          <button className="btn btn-clair mt-4 w-full" onClick={chercherPharmacies}>Trouver les pharmacies qui ont tout</button>
        </article>}
        {medicaments.some(line => line.owner_type && line.owner_type !== "pharmacie") && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Un article appartient à un autre type de professionnel. Il ne sera pas envoyé au circuit Pharmacie.</p>}
        <Link href="/achats/credit" className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-[#0B3D26] bg-[#FFF3A6] px-4 py-3 text-center font-extrabold text-[#0B3D26]">Demander un achat à crédit</Link>
      </section>}
      {pret && lignes.length > 0 && <button className="mt-6 min-h-[48px] w-full underline" onClick={vider}>Vider le panier</button>}
    </main>
  );
}
