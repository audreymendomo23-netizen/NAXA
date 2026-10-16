"use client";

export type FavoriNAXA = {
  id: string;
  nom: string;
  dosage: string;
  photo_url: string | null;
  prix: number;
  pharmacie: string;
  demo: boolean;
  savedAt: number;
};

const CLE = "naxa-favoris-v1";
const EVENEMENT = "naxa:favoris-change";

export function lireFavoris(): FavoriNAXA[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(CLE) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is FavoriNAXA =>
      !!x && typeof x.id === "string" && typeof x.nom === "string" &&
      typeof x.dosage === "string" && (typeof x.photo_url === "string" || x.photo_url === null) &&
      typeof x.prix === "number" && typeof x.pharmacie === "string" &&
      typeof x.demo === "boolean" && typeof x.savedAt === "number"
    );
  } catch {
    return [];
  }
}

export function ecrireFavoris(favoris: FavoriNAXA[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE, JSON.stringify(favoris));
    window.dispatchEvent(new CustomEvent(EVENEMENT));
  } catch {
    // Les favoris restent utilisables sans stockage persistant pendant cette visite.
  }
}

export function basculerFavori(item: Omit<FavoriNAXA, "savedAt">): FavoriNAXA[] {
  const actuels = lireFavoris();
  const existe = actuels.some(f => f.id === item.id);
  const suivants = existe
    ? actuels.filter(f => f.id !== item.id)
    : [{ ...item, savedAt: Date.now() }, ...actuels].slice(0, 100);
  ecrireFavoris(suivants);
  return suivants;
}

export function ecouterFavoris(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENEMENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENEMENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
