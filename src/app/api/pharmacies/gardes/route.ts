import { NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase/server";
import { chargerGardesMfasha, type GardeExterne } from "@/lib/pharmacies-gardes/mfasha";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type PharmaciePhoto = {
  nom: string;
  photo_url: string | null;
  photo_source_url: string | null;
  photo_verified_at: string | null;
};

function normaliserNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/\b(pharmacie|pharmacy|sarl|sa)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function associerPhotos(pharmacies: GardeExterne[]): Promise<GardeExterne[]> {
  try {
    const { data, error } = await supabasePublic(300)
      .from("pharmacies")
      .select("nom,photo_url,photo_source_url,photo_verified_at")
      .eq("actif", true)
      .eq("visible_recherche", true)
      .is("archivee_le", null)
      .not("photo_url", "is", null);

    if (error || !data?.length) return pharmacies;

    const photos = new Map<string, PharmaciePhoto>();
    for (const row of data as PharmaciePhoto[]) {
      const cle = normaliserNom(row.nom);
      // A photo is used only for an exact normalized name match and when
      // a verification date is present; never guess from a nearby name.
      if (cle && row.photo_url && row.photo_verified_at && row.photo_url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pharmacies-photos/`) && !photos.has(cle)) {
        photos.set(cle, row);
      }
    }

    return pharmacies.map((pharmacie) => {
      const photo = photos.get(normaliserNom(pharmacie.nom));
      // A verified image in our own Supabase bucket takes priority over any source image.
      if (photo?.photo_url) return { ...pharmacie, imageUrl: photo.photo_url };
      return pharmacie;
    });
  } catch {
    // The external duty list remains available if the optional photo lookup fails.
    return pharmacies;
  }
}

export async function GET() {
  const result = await chargerGardesMfasha();

  if (!result || result.pharmacies.length < 5 || !result.periode) {
    return NextResponse.json(
      {
        ok: false,
        source: "https://mfasha.com/",
        message: "La source publique est indisponible ou sa liste n'a pas pu être validée.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const pharmacies = await associerPhotos(result.pharmacies);

  return NextResponse.json(
    {
      ok: true,
      source: "https://mfasha.com/",
      fetchedAt: result.fetchedAt,
      periode: result.periode,
      pharmacies,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
