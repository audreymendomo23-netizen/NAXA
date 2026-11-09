"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const railRef = useRef<HTMLDivElement>(null);
  const pauseAutoRef = useRef(false);

  const afficherPharmacie = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    if (!pharmacies.length || !railRef.current) return;
    const nextIndex = (index + pharmacies.length) % pharmacies.length;
    const rail = railRef.current;
    const slide = rail.children.item(nextIndex) as HTMLElement | null;
    const targetLeft = slide
      ? rail.scrollLeft + slide.getBoundingClientRect().left - rail.getBoundingClientRect().left
      : nextIndex * rail.clientWidth;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollTo({ left: targetLeft, behavior: reducedMotion ? "auto" : behavior });
    setIndexVisible(nextIndex);
  }, [pharmacies.length]);

  useEffect(() => {
    if (pharmacies.length < 2 || selection) return;
    const interval = window.setInterval(() => {
      if (!pauseAutoRef.current) afficherPharmacie(indexVisible + 1);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [pharmacies.length, selection, indexVisible, afficherPharmacie]);

  return (
    <>
      {pharmacies.length > 0 && (
        <section aria-label="Pharmacies de garde" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => afficherPharmacie(indexVisible - 1)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-naxa-green-200 bg-white text-lg font-bold text-naxa-green-800 shadow-sm" aria-label="Pharmacie précédente">‹</button>
            <p className="text-center text-xs text-slate-500" aria-live="polite" aria-atomic="true">
              Pharmacie {indexVisible + 1} sur {pharmacies.length} · défilement automatique toutes les 3 secondes
            </p>
            <button type="button" onClick={() => afficherPharmacie(indexVisible + 1)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-naxa-green-200 bg-white text-lg font-bold text-naxa-green-800 shadow-sm" aria-label="Pharmacie suivante">›</button>
          </div>
          <div
            ref={railRef}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
            onScroll={(event) => {
              const rail = event.currentTarget;
              if (!rail.clientWidth) return;
              const railLeft = rail.getBoundingClientRect().left;
              let nearestIndex = 0;
              let nearestDistance = Number.POSITIVE_INFINITY;
              Array.from(rail.children).forEach((child, index) => {
                const distance = Math.abs((child as HTMLElement).getBoundingClientRect().left - railLeft);
                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  nearestIndex = index;
                }
              });
              setIndexVisible(Math.min(pharmacies.length - 1, Math.max(0, nearestIndex)));
            }}
            onTouchStart={() => { pauseAutoRef.current = true; }}
            onTouchEnd={() => { window.setTimeout(() => { pauseAutoRef.current = false; }, 1200); }}
            onMouseEnter={() => { pauseAutoRef.current = true; }}
            onMouseLeave={() => { pauseAutoRef.current = false; }}
          >
            {pharmacies.map((pharmacie) => (
              <article key={pharmacie.id} className="carte min-w-full snap-start overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() => setSelection(pharmacie)}
                  className="block w-full p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naxa-green-700"
                  aria-label={`Voir les coordonnées publiques de ${pharmacie.nom}`}
                >
                  <PhotoPharmacie nom={pharmacie.nom} src={pharmacie.imageUrl} lieu={pharmacie.quartier} illustration={pharmacie.imageType === "illustration"} />
                  <span className="block font-bold text-naxa-green-900">{pharmacie.nom}</span>
                  {pharmacie.quartier && <span className="mt-1 block text-sm text-slate-600">{pharmacie.quartier}</span>}
                  <span className="mt-1 block text-sm font-semibold text-naxa-green-700">Ouvrir la fiche · contact et localisation</span>
                  <span className="mt-2 block text-[10px] text-slate-400">Source du planning de garde : Mfasha</span>
                </button>
              </article>
            ))}
          </div>
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
