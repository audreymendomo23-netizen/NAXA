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
  photo_declaree_par_pharmacie: boolean;
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

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

function creerIllustrationPharmacie(nom: string): string {
  const label = escapeXml(nom.trim().slice(0, 72) || "Pharmacie");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480" role="img" aria-label="${label}">
  <rect width="720" height="480" rx="28" fill="#ffffff"/>
  <rect x="20" y="20" width="680" height="440" rx="24" fill="#ffffff" stroke="#e5eee8" stroke-width="3"/>
  <g transform="translate(290 72)">
    <rect x="0" y="24" width="140" height="112" rx="12" fill="#f4f8f5" stroke="#0f6b3f" stroke-width="7"/>
    <path d="M-8 24 L70 -10 L148 24" fill="#ffffff" stroke="#0f6b3f" stroke-width="7" stroke-linejoin="round"/>
    <rect x="52" y="68" width="36" height="68" rx="4" fill="#ffffff" stroke="#0f6b3f" stroke-width="5"/>
    <rect x="24" y="48" width="25" height="25" rx="3" fill="#ffffff" stroke="#0f6b3f" stroke-width="4"/>
    <rect x="92" y="48" width="25" height="25" rx="3" fill="#ffffff" stroke="#0f6b3f" stroke-width="4"/>
    <circle cx="70" cy="80" r="31" fill="#0f6b3f"/>
    <path d="M65 58 h10 v17 h17 v10 h-17 v17 h-10 v-17 h-17 v-10 h17z" fill="#ffffff"/>
  </g>
  <text x="360" y="282" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="700" fill="#0b3d26">PHARMACIE</text>
  <text x="360" y="328" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${label.length > 34 ? 23 : 29}" font-weight="600" fill="#24352b">${label}</text>
  <text x="360" y="382" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="#63756a">Illustration — photo réelle non identifiée</text>
</svg>`;
}

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

    const { data: existing } = await admin.storage.from(BUCKET).list("gardes", {
      search: `${slugPhoto(pharmacie.nom)}.`,
      limit: 100,
    });
    const match = existing?.find((item) =>
      ["jpg", "png", "webp"].some((ext) => item.name === `${slugPhoto(pharmacie.nom)}.${ext}`),
    );
    if (match) {
      const ext = match.name.split(".").pop() ?? "jpg";
      return { ...pharmacie, imageUrl: urlPhotoStockee(pharmacie.nom, ext), imageType: "photo-source" };
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

    return { ...pharmacie, imageUrl: urlPhotoStockee(pharmacie.nom, extension), imageType: "photo-source" };
  } catch {
    return pharmacie;
  }
}

/** Creates a persistent, clearly labelled fallback; never pretends it is a real photo. */
async function mettreIllustrationEnCache(pharmacie: GardeExterne): Promise<GardeExterne> {
  try {
    const svg = creerIllustrationPharmacie(pharmacie.nom);
    // Le stockage Supabase reste prioritaire. En cas de panne/configuration absente,
    // l'illustration intégrée évite une carte sans image, sans la présenter comme une photo réelle.
    const dataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return { ...pharmacie, imageUrl: dataUrl, imageType: "illustration" };

    const admin = supabaseAdmin();
    const path = `gardes/illustrations/${slugPhoto(pharmacie.nom)}.svg`;
    const url = `${base}/storage/v1/object/public/${BUCKET}/${path}`;

    const { data: existing } = await admin.storage.from(BUCKET).list("gardes/illustrations", {
      search: `${slugPhoto(pharmacie.nom)}.svg`,
      limit: 20,
    });
    if (existing?.some((item) => item.name === `${slugPhoto(pharmacie.nom)}.svg`)) {
      return { ...pharmacie, imageUrl: url, imageType: "illustration" };
    }

    const { error } = await admin.storage.from(BUCKET).upload(path, new TextEncoder().encode(svg), {
      contentType: "image/svg+xml",
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) return { ...pharmacie, imageUrl: dataUrl, imageType: "illustration" };
    return { ...pharmacie, imageUrl: url, imageType: "illustration" };
  } catch {
    return pharmacie;
  }
}

async function associerPhotos(pharmacies: GardeExterne[]): Promise<GardeExterne[]> {
  let enriched = await Promise.all(pharmacies.map((pharmacie) => mettrePhotoEnCache(pharmacie)));

  try {
    const { data, error } = await supabasePublic(300)
      .from("pharmacies")
      .select("nom,photo_url,photo_source_url,photo_verified_at,photo_declaree_par_pharmacie")
      .eq("actif", true)
      .eq("visible_recherche", true)
      .is("archivee_le", null)
      .not("photo_url", "is", null);

    if (!error && data?.length) {
      const photos = new Map<string, PharmaciePhoto>();
      const candidats = [...(data as PharmaciePhoto[])].sort(
        (a, b) => Number(b.photo_declaree_par_pharmacie) - Number(a.photo_declaree_par_pharmacie),
      );
      for (const row of candidats) {
        const cle = normaliserNom(row.nom);
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

      enriched = enriched.map((pharmacie) => {
        const photo = photos.get(normaliserNom(pharmacie.nom));
        if (photo?.photo_url) return { ...pharmacie, imageUrl: photo.photo_url, imageType: "photo-verifiee" };
        return pharmacie;
      });
    }
  } catch {
    // Photo metadata is optional; duty data must remain available.
  }

  return Promise.all(enriched.map(async (pharmacie) => {
    if (pharmacie.imageUrl) return pharmacie;
    return mettreIllustrationEnCache(pharmacie);
  }));
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
