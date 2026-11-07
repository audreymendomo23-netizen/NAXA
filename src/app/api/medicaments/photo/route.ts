import { NextRequest, NextResponse } from "next/server";
import type { MedicamentPhoto } from "@/lib/medicaments/photos-externes";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function dosageSignature(value: string): string | null {
  const matches = [...value.toLowerCase().matchAll(/(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|g|kg|ml|l|iu|ui|%)/gi)];
  return matches.length ? matches.map(match => match[1].replace(",", ".") + match[2].replace("µ", "u")).sort().join("|") : null;
}

function tokens(value: string): string[] {
  const cleaned = value
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|kg|ml|l|iu|ui|meq|mmol)\b/gi, " ")
    .replace(/\b\d+\s*(?:tablets?|capsules?|pills?|comprim[eé]s?|g[eé]lules?)\b/gi, " ");
  return [...new Set(normalize(cleaned).split(/\s+/).filter((token) =>
    token.length >= 3 && !/^\d+$/.test(token) &&
    !/^(?:tablet|tablets|capsule|capsules|pill|pills|comprime|comprim[eé]s?|boite|box|mg|mcg|ug|ml|g|iu|ui)$/.test(token)
  ))];
}

function exactIdentityMatch(query: string, candidate: string): boolean {
  const wantedDose = dosageSignature(query);
  const candidateDose = dosageSignature(candidate);
  if (wantedDose && wantedDose !== candidateDose) return false;
  const wanted = tokens(query);
  const available = new Set(tokens(candidate));
  return wanted.length > 0 && wanted.every((token) => available.has(token));
}

function unrequestedCombination(query: string, activeIngredients: string): boolean {
  if (!/[+\/,;]|\b(?:and|et)\b/i.test(activeIngredients)) return false;
  const wanted = new Set(tokens(query));
  const ingredients = tokens(activeIngredients);
  const overlapsAnIngredient = ingredients.some((token) => wanted.has(token));
  // Une recherche par marque (ex. Coartem) peut légitimement viser une association.
  // Une recherche par molécule seule ne doit pas récupérer la photo d’une association.
  return overlapsAnIngredient && ingredients.some((token) => !wanted.has(token));
}

type ReferencePhotoRow = {
  cis: string;
  nom: string;
  substances_actives: string | null;
  photo_path: string | null;
  photo_source_url: string | null;
  photo_licence: string | null;
  photo_attribution: string | null;
  photo_verifiee_le: string | null;
};

function verifiedStorageUrl(path: string | null): string | null {
  const safePath = path?.trim() ?? "";
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/[\/]+$/, "");
  if (!base || !safePath || safePath.startsWith("/") || safePath.includes("..") || safePath.includes("\\")) return null;
  try {
    const url = new URL(base + "/storage/v1/object/public/medicaments/" +
      safePath.split("/").map((segment) => encodeURIComponent(segment)).join("/"));
    if (url.protocol !== "https:" || url.origin !== new URL(base).origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function completePhoto(row: {
  photo_path: string | null;
  photo_source_url: string | null;
  photo_licence: string | null;
  photo_verifiee_le: string | null;
}): boolean {
  return Boolean(
    row.photo_path &&
    row.photo_source_url?.startsWith("https://") &&
    row.photo_licence?.trim() &&
    row.photo_verifiee_le &&
    Number.isFinite(Date.parse(row.photo_verifiee_le))
  );
}

async function verifiedLocalPhoto(query: string): Promise<MedicamentPhoto | null> {
  try {
    const sb = supabaseServer();
    const safeQuery = query
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|kg|ml|l|iu|ui|meq|mmol)\b/gi, " ")
      .replace(/\b\d+\s*(?:tablets?|capsules?|pills?|comprim[eé]s?|g[eé]lules?)\b/gi, " ")
      .replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
    if (safeQuery.length < 3) return null;

    // Photos locales importées et validées par un administrateur NAXA.
    const [byName, byIngredient] = await Promise.all([
      sb.from("produits")
        .select("nom,dci,synonymes,photo_path,photo_url,photo_source_url,photo_licence,photo_verifiee_le")
        .ilike("nom", "%" + safeQuery + "%")
        .eq("fiche_validee", true)
        .limit(12),
      sb.from("produits")
        .select("nom,dci,synonymes,photo_path,photo_url,photo_source_url,photo_licence,photo_verifiee_le")
        .ilike("dci", "%" + safeQuery + "%")
        .eq("fiche_validee", true)
        .limit(12)
    ]);
    const localProducts = [...(byName.data ?? []), ...(byIngredient.data ?? [])] as Array<{
      nom: string; dci: string | null; synonymes: string[] | null;
      photo_path: string | null; photo_url: string | null; photo_source_url: string | null;
      photo_licence: string | null; photo_verifiee_le: string | null;
    }>;
    const seen = new Set<string>();
    for (const product of localProducts) {
      const key = normalize(product.nom);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!exactIdentityMatch(query, product.nom) || unrequestedCombination(query, product.dci ?? "")) continue;
      if (!completePhoto(product)) continue;
      const url = verifiedStorageUrl(product.photo_path);
      if (!url) continue;
      return {
        url,
        sourceUrl: product.photo_source_url!,
        licence: product.photo_licence!,
        attribution: null,
        title: product.nom,
        kind: "boite"
      };
    }

    // Référentiel par CIS. Aucun CIP fictif ni table d'images orpheline n'est requis.
    const fields = "cis,nom,substances_actives,photo_path,photo_source_url,photo_licence,photo_attribution,photo_verifiee_le";
    const refs = await Promise.all([
      sb.from("medicaments_referentiel_sources").select(fields)
        .ilike("nom", "%" + safeQuery + "%").limit(30),
      sb.from("medicaments_referentiel_sources").select(fields)
        .ilike("substances_actives", "%" + safeQuery + "%").limit(30)
    ]);
    const refMap = new Map<string, ReferencePhotoRow>();
    for (const result of refs) {
      for (const row of (result.data ?? []) as ReferencePhotoRow[]) {
        if (!exactIdentityMatch(query, row.nom) || unrequestedCombination(query, row.substances_actives ?? "")) continue;
        if (!completePhoto(row)) continue;
        refMap.set(row.cis, row);
      }
    }
    for (const row of refMap.values()) {
      const url = verifiedStorageUrl(row.photo_path);
      if (!url) continue;
      return {
        url,
        sourceUrl: row.photo_source_url!,
        licence: row.photo_licence!,
        attribution: row.photo_attribution || null,
        title: row.nom,
        kind: "boite"
      };
    }
  } catch {
    // Sans preuve locale, ne jamais substituer une image approximative.
  }
  return null;
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (query.length < 3) {
    return NextResponse.json({ photo: null, photos: { boite: null, comprime: null } }, {
      headers: { "Cache-Control": "public, max-age=300" }
    });
  }

  const localPhoto = await verifiedLocalPhoto(query);
  if (localPhoto) {
    const photos = { boite: localPhoto, comprime: null };
    return NextResponse.json({ photo: localPhoto, photos, source: "catalogue_local_verifie" }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" }
    });
  }

  // Pas de recherche d’image externe automatique : un nom proche n'établit pas
  // la marque, le dosage, la forme ou le conditionnement exacts.
  const photos = { boite: null, comprime: null };
  return NextResponse.json({
    photo: null,
    photos,
    source: "aucune_photo_verifiee",
    message: "Aucune photo exacte avec provenance et droits vérifiés n’est disponible pour cette référence."
  }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" }
  });
}
