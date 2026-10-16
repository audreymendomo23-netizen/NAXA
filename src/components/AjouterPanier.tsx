"use client";

import { useState } from "react";
import { ActionProtegee } from "@/components/ActionProtegee";
import { MAX_LIGNES, MAX_QTE, usePanier } from "@/lib/panier";

export function AjouterPanier({ produit }: { produit: { produit_id: string; nom: string; dosage: string } }) {
  const { ajouter, lignes } = usePanier();
  const [qte, setQte] = useState(1);
  const [ajoute, setAjoute] = useState(false);
  const [erreur, setErreur] = useState("");
  const dansPanier = lignes.find(l => l.produit_id === produit.produit_id)?.quantite ?? 0;
  const panierPlein = !dansPanier && lignes.length >= MAX_LIGNES;

  function ajouterAuPanier() {
    setErreur("");
    if (panierPlein) {
      setErreur(`Votre panier est limité à ${MAX_LIGNES} produits différents. Retirez un produit avant d’en ajouter un autre.`);
      setAjoute(false);
      return;
    }
    ajouter(produit, qte);
    setAjoute(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-semibold" id="lbl-qte">Quantité</span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="lbl-qte">
          <button type="button" className="btn btn-clair !px-0 w-12" onClick={() => setQte(Math.max(1, qte - 1))} aria-label="Moins">−</button>
          <output className="w-8 text-center text-xl font-extrabold" aria-live="polite">{qte}</output>
          <button type="button" className="btn btn-clair !px-0 w-12" onClick={() => setQte(Math.min(MAX_QTE, qte + 1))} aria-label="Plus">+</button>
        </div>
      </div>
      <ActionProtegee className="btn btn-vert w-full" href="#" onAutorise={ajouterAuPanier}>Ajouter au panier</ActionProtegee>
      {erreur && <p role="alert" className="rounded-xl2 border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700">{erreur}</p>}
      {(ajoute || dansPanier > 0) && !erreur && (
        <p role="status" className="text-sm">
          {dansPanier} dans votre panier.{" "}
          <ActionProtegee href="/panier" className="text-left font-semibold underline underline-offset-4">Voir mon panier</ActionProtegee>
        </p>
      )}
    </div>
  );
}
