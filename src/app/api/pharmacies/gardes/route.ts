import { NextResponse } from "next/server";
import { supabaseAdmin, supabasePublic } from "@/lib/supabase/server";
import { chargerGardesMfasha, type GardeExterne } from "@/lib/pharmacies-gardes/mfasha";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const BUCKET = "pharmacies-photos";
const MAX_PHOTO_BYTES = 512 * 1024;

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

function slugPhoto(nom: string): string {
  return normaliserNom(nom).replace(/\s+/g, "-").slice(0, 90) || "pharmacie-inconnue";
}

function urlPhotoStockee(nom: string, extension: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET}/gardes/${slugPhoto(nom)}.${extension}`;
}

/**
 * Cache uniquement les photos effectivement fournies dans la fiche de la source
 * publique de garde Mfasha. Pas de recherche par nom approximatif et pas de
 * photo générique : si la source ne fournit pas d'image, on n'en invente pas.
 */
async function mettrePhotoEnCache(pharmacie: GardeExterne): Promise<GardeExterne> {
  if (!pharmacie.imageUrl) return pharmacie;

  try {
    const source = new URL(pharmacie.imageUrl);
    if (source.protocol !== "https:" || !/(^|\.)mfasha\.com$/i.test(source.hostname)) return pharmacie;

    const admin = supabaseAdmin();
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    // A previously cached image is reused to avoid a download on every request.
    const { data: existing } = await admin.storage.from(BUCKET).list("gardes", {
      search: `${slugPhoto(pharmacie.nom)}.`,
      limit: 100,
    });
    const match = existing?.find((item) =>
      ["jpg", "png", "webp"].some((ext) => item.name === `${slugPhoto(pharmacie.nom)}.${ext}`),
    );
    if (match) {
      const ext = match.name.split(".").pop() ?? "jpg";
      return { ...pharmacie, imageUrl: urlPhotoStockee(pharmacie.nom, ext) };
    }

    const response = await fetch(source.toString(), {
      headers: { Accept: "image/jpeg,image/png,image/webp" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) return pharmacie;

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const extension = extensions[contentType];
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (!extension || (declaredLength > MAX_PHOTO_BYTES)) return pharmacie;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.byteLength > MAX_PHOTO_BYTES) return pharmacie;

    const path = `gardes/${slugPhoto(pharmacie.nom)}.${extension}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) return pharmacie;

    return { ...pharmacie, imageUrl: urlPhotoStockee(pharmacie.nom, extension) };
  } catch {
    // Image caching is optional; duty results must still be returned.
    return pharmacie;
  }
}

async function associerPhotos(pharmacies: GardeExterne[]): Promise<GardeExterne[]> {
  let enriched = pharmacies;

  // Cache the source photo when Mfasha supplies one. Failures do not block
  // the list of pharmacies on duty.
  enriched = await Promise.all(enriched.map((pharmacie) => mettrePhotoEnCache(pharmacie)));

  try {
    const { data, error } = await supabasePublic(300)
      .from("pharmacies")
      .select("nom,photo_url,photo_source_url,photo_verified_at")
      .eq("actif", true)
      .eq("visible_recherche", true)
      .is("archivee_le", null)
      .not("photo_url", "is", null);

    if (error || !data?.length) return enriched;

    const photos = new Map<string, PharmaciePhoto>();
    for (const row of data as PharmaciePhoto[]) {
      const cle = normaliserNom(row.nom);
      // A photo from the pharmacy directory takes priority only after
      // its match has been explicitly verified and it lives in our bucket.
      if (
        cle &&
        row.photo_url &&
        row.photo_verified_at &&
        row.photo_url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`) &&
        !photos.has(cle)
      ) {
        photos.set(cle, row);
      }
    }

    return enriched.map((pharmacie) => {
      const photo = photos.get(normaliserNom(pharmacie.nom));
      if (photo?.photo_url) return { ...pharmacie, imageUrl: photo.photo_url };
      return pharmacie;
    });
  } catch {
    return enriched;
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
