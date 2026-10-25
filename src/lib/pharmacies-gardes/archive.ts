import { supabaseAdmin } from "@/lib/supabase/server";

type ArchivePharmacie = {
  id: string;
  nom: string;
  quartier: string | null;
  telephone: string | null;
  autresTelephones: string[];
  imageUrl: string | null;
  imageType?: string;
  periode: string | null;
  source: string;
};

function safeSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "periode";
}

/** Keeps a dated copy of public duty data and stable NAXA image URLs in Supabase Storage. */
export async function archiverDonneesGarde(
  pharmacies: ArchivePharmacie[],
  periode: string,
  fetchedAt: string,
): Promise<void> {
  try {
    const date = new Date(fetchedAt).toISOString().slice(0, 10);
    const filename = `${date}-${safeSlug(periode)}.json`;
    const storage = supabaseAdmin().storage.from("pharmacies-photos");
    const { data: existing } = await storage.list("gardes/snapshots", { search: filename, limit: 20 });
    if (existing?.some((item) => item.name === filename)) return;

    const snapshot = {
      archiveeLe: fetchedAt,
      sourceDonnees: "https://mfasha.com/",
      annuaireDeReference: "https://mboapharma.cm/annuaire-des-pharmacies/",
      periode,
      pharmacies,
      avertissement: "Copie historique NAXA. Confirmer les horaires et coordonnées avant déplacement.",
    };
    await storage.upload(`gardes/snapshots/${filename}`, new TextEncoder().encode(JSON.stringify(snapshot, null, 2)), {
      contentType: "application/json",
      upsert: false,
      cacheControl: "31536000",
    });
  } catch {
    // La disponibilité de la liste ne dépend pas du succès de l'archivage.
  }
}
