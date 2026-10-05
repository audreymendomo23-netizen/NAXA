import { supabaseBrowser } from "@/lib/supabase/client";

export type EvenementType = "recherche" | "fiche_vue" | "panier_ajout" | "scan_ordonnance";

export async function suivre(input: {
  type: EvenementType;
  produitId?: string;
  pharmacieId?: string;
  terme?: string;
  resultats?: number;
  lat?: number;
  lng?: number;
}) {
  const sb = supabaseBrowser();
  const { error } = await sb.rpc("log_evenement", {
    p_type: input.type,
    p_produit: input.produitId ?? null,
    p_pharmacie: input.pharmacieId ?? null,
    p_terme: input.terme ?? null,
    p_resultats: input.resultats ?? null,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
  });
  if (error) console.warn("NAXA: événement non enregistré", error.message);
}
