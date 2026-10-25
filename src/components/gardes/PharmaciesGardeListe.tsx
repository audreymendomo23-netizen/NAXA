"use client";

import { useEffect, useState } from "react";
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
  horaires?: string | null;
  source: string;
};

type Props = { pharmacies: PharmacieGardeCard[]; sourceAnnuaireUrl: string };

function nettoyerTelephone(value: string): string {
  return value.replace(/[^+\d]/g, "");
}

export function PharmaciesGardeListe({ pharmacies, sourceAnnuaireUrl }: Props) {
  const [selection, setSelection] = useState<PharmacieGardeCard | null>(null);
  const [indexVisible, setIndexVisible] = useState(0);

  useEffect(() => {
    if (pharmacies.length < 2 || selection) return;
    const interval = window.setInterval(() => {
      setIndexVisible((index) => (index + 1) % pharmacies.length);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [pharmacies.length, selection]);

  const pharmacieVisible = pharmacies.length ? pharmacies[indexVisible % pharmacies.length] : null;

  return (
    <>
      {pharmacieVisible && (
        <section aria-live="polite" aria-atomic="true" className="space-y-2">
          <p className="text-center text-xs text-slate-500">
            Pharmacie {indexVisible + 1} sur {pharmacies.length} · changement automatique toutes les 3 secondes
          </p>
          <ul className="grid grid-cols-1 gap-3">
            <li key={pharmacieVisible.id} className="carte animate-[pharmacieFadeIn_300ms_ease-in-out] overflow-hidden space-y-0">
              <button
                type="button"
                onClick={() => setSelection(pharmacieVisible)}
                className="block w-full p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naxa-green-700"
                aria-label={`Voir les coordonnées publiques de ${pharmacieVisible.nom}`}
              >
                <PhotoPharmacie nom={pharmacieVisible.nom} src={pharmacieVisible.imageUrl} lieu={pharmacieVisible.quartier} illustration={pharmacieVisible.imageType === "illustration"} />
                <span className="block font-bold text-naxa-green-900">{pharmacieVisible.nom}</span>
                {pharmacieVisible.quartier && <span className="mt-1 block text-sm text-slate-600">{pharmacieVisible.quartier}</span>}
                <span className="mt-1 block text-sm font-semibold text-naxa-green-700">Ouvrir la fiche · contact et localisation</span>
                <span className="mt-2 block text-[10px] text-slate-400">Source du planning de garde : Mfasha</span>
              </button>
            </li>
          </ul>
        </section>
      )}

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

            <PhotoPharmacie nom={selection.nom} src={selection.imageUrl} lieu={selection.quartier} illustration={selection.imageType === "illustration"} />

            <section className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4" aria-label="Coordonnées publiques">
              <h3 className="font-bold text-naxa-green-900">Coordonnées publiques</h3>
              {selection.quartier
                ? <p className="mt-2 text-sm leading-5 text-slate-700">Localisation / quartier publié : {selection.quartier}</p>
                : <p className="mt-2 text-sm text-slate-600">Aucun quartier précis n’est renseigné dans la liste publique.</p>}
              {selection.horaires?.trim() && <p className="mt-2 text-sm text-slate-700">Horaires publiés : {selection.horaires}</p>}
              {selection.telephone ? (
                <a
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-naxa-green-700 px-4 font-extrabold text-white hover:bg-naxa-green-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naxa-green-700"
                  href={`tel:${nettoyerTelephone(selection.telephone)}`}
                  aria-label={`Appeler ${selection.nom} au ${selection.telephone}`}
                >
                  <span aria-hidden="true">☎</span> Appeler la pharmacie
                </a>
              ) : <p className="mt-3 text-sm text-slate-600">Aucun numéro public n’est disponible dans la source de garde.</p>}
              {selection.autresTelephones.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-700">Autres numéros publics</p>
                  <ul className="mt-1 space-y-1">
                    {selection.autresTelephones.map((telephone) => (
                      <li key={telephone}>
                        <a className="text-sm font-semibold text-naxa-green-700 underline underline-offset-2" href={`tel:${nettoyerTelephone(telephone)}`}>{telephone} · Appeler</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selection.quartier && (
                <a
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-naxa-green-700 bg-white px-4 text-sm font-bold text-naxa-green-800 underline-offset-2 hover:underline"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([selection.nom, selection.quartier].filter(Boolean).join(" "))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voir la localisation sur la carte
                </a>
              )}
            </section>

            {selection.periode && (
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <strong>Période de garde publiée :</strong> {selection.periode}
              </p>
            )}

            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-[10px] leading-relaxed text-slate-400">
                Planning de garde : <a href={selection.source} target="_blank" rel="noreferrer" className="underline">Mfasha</a>.
                {selection.imageType === "photo-source" && <> Image archivée depuis une fiche d’annuaire externe ; <a href={sourceAnnuaireUrl} target="_blank" rel="noreferrer" className="underline">consulter l’annuaire MboaPHARMA</a> pour la provenance.</>}
                {selection.imageType === "photo-verifiee" && " Image vérifiée et hébergée par NAXA."}
                {selection.imageType === "illustration" && " Illustration NAXA, pas une photographie réelle."}
                {!selection.imageType && " L’image peut être une illustration de remplacement."}
                {" "}Les coordonnées et horaires ne sont affichés que lorsqu’ils sont présents dans les données publiques; NAXA ne les invente pas. Appelez avant de vous déplacer, car le planning peut changer.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
