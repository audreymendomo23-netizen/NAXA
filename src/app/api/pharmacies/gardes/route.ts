import { NextResponse } from "next/server";
import { supabaseAdmin, supabasePublic } from "@/lib/supabase/server";
import type { GardeExterne } from "@/lib/pharmacies-gardes/mfasha";

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

function creerIllustrationPharmacie(pharmacie: GardeExterne): string {
  const nom = escapeXml(pharmacie.nom.trim().slice(0, 72) || "Pharmacie");
  const lieu = pharmacie.quartier?.trim()
    ? escapeXml(pharmacie.quartier.trim().slice(0, 90))
    : "Localisation non renseignée";
  const telephone = pharmacie.telephone?.trim()
    ? escapeXml(`Tél. ${pharmacie.telephone.trim().slice(0, 36)}`)
    : "Téléphone non renseigné";
  const periode = pharmacie.periode?.trim()
    ? escapeXml(pharmacie.periode.trim().slice(0, 90))
    : "Période publiée par la source de garde";
  const tailleNom = nom.length > 34 ? 22 : 28;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480" role="img" aria-label="Illustration de ${nom}">
  <rect width="720" height="480" rx="28" fill="#ffffff"/>
  <rect x="20" y="20" width="680" height="440" rx="24" fill="#ffffff" stroke="#e5eee8" stroke-width="3"/>
  <g transform="translate(300 40) scale(.86)">
    <rect x="0" y="24" width="140" height="112" rx="12" fill="#f4f8f5" stroke="#0f6b3f" stroke-width="7"/>
    <path d="M-8 24 L70 -10 L148 24" fill="#ffffff" stroke="#0f6b3f" stroke-width="7" stroke-linejoin="round"/>
    <rect x="52" y="68" width="36" height="68" rx="4" fill="#ffffff" stroke="#0f6b3f" stroke-width="5"/>
    <rect x="24" y="48" width="25" height="25" rx="3" fill="#ffffff" stroke="#0f6b3f" stroke-width="4"/>
    <rect x="92" y="48" width="25" height="25" rx="3" fill="#ffffff" stroke="#0f6b3f" stroke-width="4"/>
    <circle cx="70" cy="80" r="31" fill="#0f6b3f"/>
    <path d="M65 58 h10 v17 h17 v10 h-17 v17 h-10 v-17 h-17 v-10 h17z" fill="#ffffff"/>
  </g>
  <text x="360" y="205" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${tailleNom}" font-weight="700" fill="#0b3d26">${nom}</text>
  <text x="360" y="250" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="19" fill="#24352b">${lieu}</text>
  <text x="360" y="290" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600" fill="#0f6b3f">${telephone}</text>
  <text x="360" y="332" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#63756a">${periode}</text>
  <text x="360" y="392" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#63756a">Illustration NAXA • pas une photo réelle</text>
</svg>`;
}

async function trouverPhotoMboa(pharmacie: GardeExterne): Promise<string | null> {
  const slug = slugPhoto(pharmacie.nom);
  const variantes = [...new Set([slug, slug.startsWith("pharmacie-") ? slug : `pharmacie-${slug}`])];
  const nomCle = normaliserNom(pharmacie.nom);
  const tokens = nomCle.split(" ").filter((token) => token.length >= 4);

  for (const variante of variantes) {
    try {
      const pageUrl = `https://mboapharma.cm/directory/${variante}/`;
      const page = await fetch(pageUrl, {
        headers: { Accept: "text/html", "User-Agent": "NAXA-pharmacy-directory/1.0" },
        signal: AbortSignal.timeout(3500),
        cache: "no-store",
      });
      if (!page.ok) continue;
      const html = await page.text();
      const title = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
      const titleCle = normaliserNom(title.replace(/<[^>]+>/g, " "));
      // On ne prend une image qu'à partir d'une fiche Mboa dont le titre correspond au nom recherché.
      if (!titleCle || !(titleCle === nomCle || tokens.every((token) => titleCle.includes(token)))) continue;

      const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
      for (const tag of imageTags) {
        const src = tag.match(/\b(?:src|data-src)\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!src) continue;
        const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
        const imageTitle = tag.match(/\btitle\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
        try {
          const image = new URL(src, pageUrl);
          if (image.protocol !== "https:" || !/(^|\.)mboapharma\.cm$/i.test(image.hostname)) continue;
          // Le titre de la fiche Mboa a déjà été rapproché du nom de la pharmacie.
          // Dans ce contexte, MboaPHARMA est la source de vérité demandée pour les images de sa fiche.
          if (/logo|avatar|placeholder|default|banner|banniere/i.test(image.href)) continue;
          if (tokens.length) return image.toString();
        } catch {
          // Image invalide : essayer la suivante.
        }
      }
    } catch {
      // La fiche peut refuser les robots ou être momentanément indisponible.
    }
  }
  return null;
}

async function mettrePhotoEnCache(pharmacie: GardeExterne): Promise<GardeExterne> {
  try {
    const sourceUrl = pharmacie.imageUrl ?? await trouverPhotoMboa(pharmacie);
    if (!sourceUrl) return pharmacie;
    const source = new URL(sourceUrl);
    if (
      source.protocol !== "https:" ||
      (!/(^|\.)mfasha\.com$/i.test(source.hostname) &&
        !/(^|\.)mboapharma\.cm$/i.test(source.hostname))
    ) return pharmacie;

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
  const svg = creerIllustrationPharmacie(pharmacie);
  const dataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { ...pharmacie, imageUrl: dataUrl, imageType: "illustration" };

  try {
    const admin = supabaseAdmin();
    const path = `gardes/illustrations/${slugPhoto(pharmacie.nom)}.svg`;
    const url = `${base}/storage/v1/object/public/${BUCKET}/${path}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, new TextEncoder().encode(svg), {
      contentType: "image/svg+xml",
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) return { ...pharmacie, imageUrl: dataUrl, imageType: "illustration" };
    return { ...pharmacie, imageUrl: url, imageType: "illustration" };
  } catch {
    // L'illustration reste disponible même si le stockage Supabase est inaccessible.
    return { ...pharmacie, imageUrl: dataUrl, imageType: "illustration" };
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
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const verificationMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabasePublic(30)
      .from("pharmacies")
      .select("id,nom,ville,region,quartier,adresse,lat,lng,de_garde,photo_url,photo_verified_at,garde_debut,garde_fin,garde_source_url,garde_verifiee_le")
      .eq("actif", true)
      .eq("visible_recherche", true)
      .eq("est_demo", false)
      .is("archivee_le", null)
      .eq("de_garde", true)
      .lte("garde_debut", nowIso)
      .gt("garde_fin", nowIso)
      .not("garde_source_url", "is", null)
      .gte("garde_verifiee_le", verificationMin)
      .order("region", { ascending: true })
      .order("ville", { ascending: true })
      .order("nom", { ascending: true })
      .limit(500);

    if (error) {
      return NextResponse.json({
        ok: false,
        message: "Le planning NAXA n’a pas pu être vérifié.",
        pharmacies: [],
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const pharmacies = (data ?? []).map((row) => {
      const photoUrl = typeof row.photo_url === "string" && row.photo_verified_at
        && base && row.photo_url.startsWith(`${base}/storage/v1/object/public/${BUCKET}/`)
        ? row.photo_url
        : null;
      const format = (value: string) => new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Africa/Douala",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
      return {
        id: row.id,
        nom: row.nom,
        quartier: row.quartier || row.adresse || row.ville || null,
        telephone: null,
        autresTelephones: [],
        imageUrl: photoUrl,
        imageType: photoUrl ? "photo-verifiee" : undefined,
        periode: `${format(row.garde_debut)} au ${format(row.garde_fin)}`,
        source: row.garde_source_url,
        ville: row.ville,
        region: row.region,
        lat: row.lat,
        lng: row.lng,
        gardeVerifieeLe: row.garde_verifiee_le,
      };
    });

    return NextResponse.json({
      ok: true,
      source: "NAXA — plannings partenaires vérifiés",
      fetchedAt: nowIso,
      pharmacies,
    }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    return NextResponse.json({
      ok: false,
      message: "Le planning NAXA est momentanément indisponible.",
      pharmacies: [],
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
