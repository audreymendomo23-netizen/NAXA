"use client";

import { useState } from "react";

type PhotoPharmacieProps = {
  nom: string;
  src?: string | null;
  lieu?: string | null;
  className?: string;
  hauteur?: "compacte" | "standard";
  illustration?: boolean;
};

/**
 * Photo réelle si elle existe; sinon une carte blanche portant le nom exact
 * de la pharmacie. Le même repli s'applique si l'image échoue au chargement.
 */
export function PhotoPharmacie({
  nom,
  src,
  lieu,
  className = "",
  hauteur = "standard",
  illustration = false,
}: PhotoPharmacieProps) {
  const [sourceEnErreur, setSourceEnErreur] = useState<string | null>(null);
  const afficherPhoto = Boolean(src) && sourceEnErreur !== src;

  const hauteurClasse = hauteur === "compacte" ? "h-28" : "h-44";

  return (
    <div
      className={`mb-3 ${hauteurClasse} w-full overflow-hidden rounded-xl border border-slate-100 bg-white ${className}`}
    >
      {afficherPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={`${illustration ? "Illustration" : "Photo"} de la pharmacie ${nom}`}
          loading="lazy"
          onError={() => setSourceEnErreur(src ?? null)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 bg-white px-4 text-center"
          role="img"
          aria-label={`Aucune photo disponible pour ${nom}`}
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-100 text-2xl font-semibold text-naxa-green-700"
          >
            ✚
          </span>
          <span className="max-w-full break-words text-sm font-extrabold uppercase tracking-wide text-naxa-green-900">
            {nom}
          </span>
          {lieu && <span className="max-w-full break-words text-xs text-slate-500">{lieu}</span>}
        </div>
      )}
    </div>
  );
}
