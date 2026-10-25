"use client";

import { useState } from "react";
import { PhotoPharmacie } from "@/components/PhotoPharmacie";

export type PharmacieGardeCard = {
  id: string;
  nom: string;
  quartier: string | null;
  telephone: string | null;
  autresTelephones: string[];
  imageUrl: string | null;
  imageType?: "photo-verifiee" | "photo-source" | "illustration";
  periode: string | null;
  source: string;
};

type Props = { pharmacies: PharmacieGardeCard[]; sourceAnnuaireUrl: string };

export function PharmaciesGardeListe({ pharmacies, sourceAnnuaireUrl }: Props) {
  const [selection, setSelection] = useState<PharmacieGardeCard | null>(null);

  return (
    <>
      <ul className="space-y-3">
        {pharmacies.map((p) => (
          <li key={p.id} className="carte overflow-hidden space-y-0">
            <button
              type="button"
              onClick={() => setSelection(p)}
              className="block w-full p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naxa-green-700"
              aria-label={`Voir les informations de ${p.nom}`}
            >
              <PhotoPharmacie nom={p.nom} src={p.imageUrl} lieu={p.quartier} />
              <span className="block font-bold text-naxa-green-900">{p.nom}</span>
              {p.quartier && <span className="mt-1 block text-sm text-slate-600">{p.quartier}</span>}
              {p.telephone && <span className="mt-1 block text-sm text-naxa-green-700">Appuyer pour voir les coordonnées et détails</span>}
              <span className="mt-2 block text-[10px] text-slate-400">Source des gardes : Mfasha</span>
            </button>
          </li>
        ))}
      </ul>

      {selection && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={(event) => { if (event.target === event.currentTarget) setSelection(null); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pharmacie-garde-titre"
            className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="pharmacie-garde-titre" className="text-xl font-extrabold text-naxa-green-900">{selection.nom}</h2>
              <button type="button" onClick={() => setSelection(null)} className="min-h-10 min-w-10 rounded-full border text-xl" aria-label="Fermer les informations">×</button>
            </div>
            <PhotoPharmacie nom={selection.nom} src={selection.imageUrl} lieu={selection.quartier} />
            {selection.quartier && <p className="text-sm text-slate-700">Zone / localisation publiée : {selection.quartier}</p>}
            {selection.periode && <p className="mt-2 text-sm text-slate-700">Période de garde : {selection.periode}</p>}
            {selection.telephone && (
              <p className="mt-3 text-sm text-slate-700">
                Téléphone : <a className="font-semibold text-naxa-green-700 underline" href={`tel:${selection.telephone.replace(/[^+\d]/g, "")}`}>{selection.telephone}</a>
              </p>
            )}
            {selection.autresTelephones.length > 0 && (
              <p className="mt-2 text-sm text-slate-600">Autres numéros : {selection.autresTelephones.join(" · ")}</p>
            )}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-[10px] leading-relaxed text-slate-400">
                Données de garde : <a href={selection.source} target="_blank" rel="noreferrer" className="underline">Mfasha</a>.
                {selection.imageType === "photo-source" && <> Image archivée depuis une fiche d’annuaire externe ; <a href={sourceAnnuaireUrl} target="_blank" rel="noreferrer" className="underline">MboaPHARMA</a> peut être consulté pour la provenance.</>}
                {selection.imageType === "photo-verifiee" && " Image vérifiée et hébergée par NAXA."}
                {selection.imageType === "illustration" && " Illustration NAXA, pas une photographie réelle."}
                {!selection.imageType && " L’image peut être une illustration de remplacement."}
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
