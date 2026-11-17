"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type LignePanier = {
  produit_id: string;
  nom: string;
  dosage: string;
  quantite: number;
  type_article?: "medicament" | "bebe-maman";
  universe_product_id?: string;
  owner_type?: "pharmacie" | "parapharmacie";
  owner_id?: string;
  pharmacie_id?: string;
  partner_id?: string;
  pharmacie_nom?: string;
  prix_unitaire_fcfa?: number;
  photo_url?: string | null;
  quantite_max?: number;
};

const CLE = "naxa-panier-v1";
const MAX_LIGNES = 10;
const MAX_QTE = 10;

type Ctx = {
  lignes: LignePanier[];
  nombre: number;
  pret: boolean;
  ajouter: (l: Omit<LignePanier, "quantite">, quantite?: number, origine?: DOMRect) => boolean;
  changerQuantite: (
    id: string,
    q: number,
    patch?: Partial<LignePanier>,
    ownerType?: LignePanier["owner_type"],
    ownerId?: string,
  ) => void;
  retirer: (id: string, ownerType?: LignePanier["owner_type"], ownerId?: string) => void;
  vider: () => void;
};

const C = createContext<Ctx | null>(null);

function lire(): LignePanier[] {
  try {
    const x = JSON.parse(localStorage.getItem(CLE) || "[]");
    return Array.isArray(x)
      ? x
          .filter(
            (l) =>
              l?.produit_id &&
              Number.isInteger(l?.quantite) &&
              l.quantite > 0 &&
              l.quantite <= MAX_QTE &&
              (!l.type_article || l.type_article === "medicament" || l.type_article === "bebe-maman") &&
              (!l.quantite_max ||
                (Number.isInteger(l.quantite_max) && l.quantite_max > 0 && l.quantite_max <= MAX_QTE)),
          )
          .slice(0, MAX_LIGNES)
      : [];
  } catch {
    return [];
  }
}

const typeProprietaire = (ligne: LignePanier): LignePanier["owner_type"] =>
  ligne.owner_type ?? (ligne.pharmacie_id ? "pharmacie" : ligne.partner_id ? "parapharmacie" : undefined);

const idProprietaire = (ligne: LignePanier): string | undefined =>
  ligne.owner_id ?? ligne.pharmacie_id ?? ligne.partner_id;

export function PanierProvider({ children }: { children: React.ReactNode }) {
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    setLignes(lire());
    setPret(true);
  }, []);

  const save = useCallback((next: LignePanier[]) => {
    setLignes(next);
    try {
      localStorage.setItem(CLE, JSON.stringify(next));
    } catch {
      // Le panier reste disponible en mémoire si le stockage local est indisponible.
    }
  }, []);

  const ajouter = useCallback(
    (ligne: Omit<LignePanier, "quantite">, quantite = 1, origine?: DOMRect): boolean => {
      const panier = lire();
      const type = typeProprietaire(ligne as LignePanier);
      const ownerId = idProprietaire(ligne as LignePanier);
      const existante = panier.find(
        (item) =>
          item.produit_id === ligne.produit_id &&
          item.type_article === ligne.type_article &&
          typeProprietaire(item) === type &&
          idProprietaire(item) === ownerId,
      );
      const limite = Math.min(MAX_QTE, Math.max(1, Math.floor(Number(ligne.quantite_max ?? MAX_QTE))));

      if (existante) {
        existante.quantite_max = limite;
        if (existante.quantite >= limite) {
          existante.quantite = limite;
          save(panier);
          return false;
        }
        existante.quantite = Math.min(limite, existante.quantite + Math.max(1, Math.floor(quantite)));
      } else {
        if (panier.length >= MAX_LIGNES) return false;
        panier.push({
          ...ligne,
          quantite: Math.min(limite, Math.max(1, Math.floor(quantite))),
          quantite_max: limite,
        });
      }

      save(panier);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("naxa:panier-ajoute", {
            detail: {
              nom: ligne.nom,
              dosage: ligne.dosage,
              origine: origine
                ? { x: origine.left + origine.width / 2, y: origine.top + origine.height / 2 }
                : null,
            },
          }),
        );
      }
      return true;
    },
    [save],
  );

  const changerQuantite = useCallback(
    (
      id: string,
      quantite: number,
      patch: Partial<LignePanier> = {},
      ownerType?: LignePanier["owner_type"],
      ownerId?: string,
    ) => {
      save(
        lire().map((ligne) => {
          const typeMatch =
            !ownerType ||
            typeProprietaire(ligne) === ownerType;
          const ownerMatch = !ownerId || idProprietaire(ligne) === ownerId;
          if (ligne.produit_id !== id || !typeMatch || !ownerMatch) return ligne;
          return {
            ...ligne,
            ...patch,
            quantite: Math.min(
              patch.quantite_max ?? ligne.quantite_max ?? MAX_QTE,
              Math.max(1, quantite),
            ),
          };
        }),
      );
    },
    [save],
  );

  const retirer = useCallback(
    (id: string, ownerType?: LignePanier["owner_type"], ownerId?: string) => {
      save(
        lire().filter((ligne) => {
          if (ligne.produit_id !== id) return true;
          if (ownerType && typeProprietaire(ligne) !== ownerType) return true;
          if (ownerId && idProprietaire(ligne) !== ownerId) return true;
          return false;
        }),
      );
    },
    [save],
  );

  const vider = useCallback(() => save([]), [save]);

  const valeur = useMemo(
    () => ({
      lignes,
      nombre: lignes.reduce((total, ligne) => total + ligne.quantite, 0),
      pret,
      ajouter,
      changerQuantite,
      retirer,
      vider,
    }),
    [lignes, pret, ajouter, changerQuantite, retirer, vider],
  );

  return <C.Provider value={valeur}>{children}</C.Provider>;
}

export function usePanier() {
  const contexte = useContext(C);
  if (!contexte) throw new Error("usePanier doit être utilisé dans PanierProvider");
  return contexte;
}

export { MAX_QTE, MAX_LIGNES };
