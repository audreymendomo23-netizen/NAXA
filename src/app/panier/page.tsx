"use client";

import Link from "next/link";
import { IllustrationPageClient } from "@/components/IllustrationPageClient";
import { useRouter } from "next/navigation";
import { MAX_QTE, usePanier } from "@/lib/panier";

export default function Panier() {
  const router = useRouter();
  const { lignes, pret, changerQuantite, retirer, vider } = usePanier();

  const chercher = () => {
    const p = new URLSearchParams();
    lignes.forEach((l) => p.append("p", `${l.produit_id}:${l.quantite}`));
    router.push(`/resultats?${p.toString()}`);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
      <IllustrationPageClient src="/couvertures/panier-reservations.webp" alt="Illustration du panier et des réservations" titre="Mon panier" />
      <div className="mb-4 flex justify-end"><Link href="/client" className="text-sm font-semibold text-naxa-green-900 underline">Continuer mes achats</Link></div>

      <h1 className="text-2xl font-extrabold">Mon panier</h1>
      <p className="mt-1 text-sm text-slate-600">Le panier reste sur votre téléphone.</p>

      {!pret && <p>Chargement…</p>}

      {pret && lignes.length === 0 && (
        <div className="carte mt-6">
          <p className="font-bold">Votre panier est vide.</p>
          <Link href="/" className="btn btn-vert mt-4 w-full">Chercher un médicament</Link>
        </div>
      )}

      {pret && lignes.length > 0 && (
        <>
          <ul className="mt-6 space-y-3">
            {lignes.map((l) => (
              <li key={l.produit_id} className="carte">
                <Link href={`/produit/${l.produit_id}`} className="font-bold underline">
                  {l.nom}
                </Link>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      className="btn btn-clair !px-0 w-12"
                      onClick={() => changerQuantite(l.produit_id, l.quantite - 1)}
                      disabled={l.quantite <= 1}
                    >
                      −
                    </button>
                    <output className="w-8 text-center text-xl font-extrabold">{l.quantite}</output>
                    <button
                      className="btn btn-clair !px-0 w-12"
                      onClick={() => changerQuantite(l.produit_id, l.quantite + 1)}
                      disabled={l.quantite >= MAX_QTE}
                    >
                      +
                    </button>
                  </div>
                  <button className="text-red-700 underline" onClick={() => retirer(l.produit_id)}>
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button className="btn btn-vert mt-6 w-full" onClick={chercher}>
            Trouver les pharmacies qui ont tout
          </button>
          <button className="mt-3 min-h-[48px] w-full underline" onClick={vider}>
            Vider le panier
          </button>
        </>
      )}
    </main>
  );
}
