import { NextRequest, NextResponse } from "next/server";
import { rechercherPhotosMedicament, type MedicamentPhoto } from "@/lib/medicaments/photos-externes";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value: string): string[] {
  return [...new Set(normalize(value).split(/\s+/).filter((token) =>
    token.length >= 3 && !/^\d+$/.test(token) &&
    !/^(?:tablet|tablets|capsule|capsules|pill|pills|comprime|comprim[eé]s?|boite|box|mg|mcg|ug|ml|g|iu|ui)$/.test(token)
  ))];
}

function exactIdentityMatch(query: string, candidate: string): boolean {
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

type ImageRow = {
  cis: string;
  libelle_presentation: string | null;
  image_path: string | null;
  image_url: string | null;
  source_nom: string;
  source_url: string | null;
  licence: string | null;
  statut: string;
};

async function verifiedLocalPhoto(query: string): Promise<MedicamentPhoto | null> {
  try {
    const sb = supabaseServer();
    const safeQuery = query
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|kg|ml|l|iu|ui|meq|mmol)\b/gi, " ")
      .replace(/\b(?:tablets?|capsules?|pills?|comprim[eé]s?|g[eé]lules?|box|bo[iî]te)\b/gi, " ")
      .replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
    if (safeQuery.length < 3) return null;

    const fields = "nom,dci,synonymes,photo_path,photo_url,photo_source_url,photo_licence,photo_verifiee_le";
    const barcode = query.replace(/\D/g, "");
    if (/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(barcode)) {
      // Un GTIN ne peut retrouver qu'une fiche portant exactement ce code.
      const { data } = await sb.from("produits")
        .select(fields)
        .eq("code_barre", barcode)
        .limit(2);
      for (const product of (data ?? []) as Array<{
        nom: string; dci: string | null; synonymes: string[] | null;
        photo_path: string | null; photo_url: string | null; photo_source_url: string | null;
        photo_licence: string | null; photo_verifiee_le: string | null;
      }>) {
        if (!product.photo_licence || !product.photo_verifiee_le || !product.photo_source_url?.startsWith("https://")) continue;
        const url = product.photo_path
          ? sb.storage.from("medicaments").getPublicUrl(product.photo_path).data.publicUrl
          : product.photo_url;
        if (!url?.startsWith("https://")) continue;
        return {
          url,
          sourceUrl: product.photo_source_url,
          licence: product.photo_licence,
          attribution: null,
          title: product.nom,
          kind: "boite",
          provider: "catalogue_local_verifie"
        };
      }
      return null;
    }

    // Première priorité : fiche locale NAXA dont la photo a une licence et une date de vérification.
    const [byName, byIngredient] = await Promise.all([
      sb.from("produits")
        .select(fields)
        .ilike("nom", "%" + safeQuery + "%")
        .limit(12),
      sb.from("produits")
        .select("nom,dci,synonymes,photo_path,photo_url,photo_source_url,photo_licence,photo_verifiee_le")
        .ilike("dci", "%" + safeQuery + "%")
        .limit(12)
    ]);
    const localProducts = [...(byName.data ?? []), ...(byIngredient.data ?? [])] as Array<{
      nom: string; dci: string | null; synonymes: string[] | null;
      photo_path: string | null; photo_url: string | null; photo_source_url: string | null;
      photo_licence: string | null; photo_verifiee_le: string | null;
    }>;
    const seen = new Set<string>();
    for (const product of localProducts) {
      const identity = product.nom;
      const key = normalize(identity);
      if (seen.has(key)) continue;
      seen.add(key);
      // Ne pas montrer la photo d'une marque lorsque la requête ne nomme que sa DCI.
      if (!exactIdentityMatch(query, identity)) continue;
      if (unrequestedCombination(query, product.dci ?? "")) continue;
      if (!product.photo_licence || !product.photo_verifiee_le || !product.photo_source_url) continue;
      const url = product.photo_path
        ? sb.storage.from("medicaments").getPublicUrl(product.photo_path).data.publicUrl
        : product.photo_url;
      if (!url?.startsWith("https://")) continue;
      return {
        url,
        sourceUrl: product.photo_source_url,
        licence: product.photo_licence,
        attribution: null,
        title: product.nom,
        kind: "boite",
        provider: "catalogue_local_verifie"
      };
    }

    // Deuxième priorité : le catalogue d'images par CIS/CIP. Les lignes non validées
    // ou sans fichier, licence et source ne sont jamais montrées.
    const refs = await Promise.all([
      sb.from("medicaments_referentiel_sources").select("cis,nom,substances_actives")
        .ilike("nom", "%" + safeQuery + "%").limit(20),
      sb.from("medicaments_referentiel_sources").select("cis,nom,substances_actives")
        .ilike("substances_actives", "%" + safeQuery + "%").limit(20)
    ]);
    const refMap = new Map<string, { cis: string; nom: string; substances_actives: string | null }>();
    for (const row of refs.flatMap((result) => result.data ?? [])) {
      // Le nom du médicament doit correspondre; la seule DCI ne suffit pas à
      // justifier la photo d'une présentation commerciale différente.
      if (exactIdentityMatch(query, row.nom) && !unrequestedCombination(query, row.substances_actives ?? "")) refMap.set(row.cis, row);
    }
    const cisList = [...refMap.keys()].slice(0, 30);
    if (!cisList.length) return null;
    const { data: images } = await sb.from("medicaments_images")
      .select("cis,libelle_presentation,image_path,image_url,source_nom,source_url,licence,statut")
      .in("cis", cisList)
      .eq("statut", "image_stockee")
      .not("licence", "is", null)
      .not("source_url", "is", null)
      .limit(30);
    for (const image of (images ?? []) as ImageRow[]) {
      if (!image.licence?.trim() || !image.source_url?.startsWith("https://")) continue;
      const url = image.image_path
        ? sb.storage.from("medicaments").getPublicUrl(image.image_path).data.publicUrl
        : image.image_url;
      if (!url?.startsWith("https://")) continue;
      const ref = refMap.get(image.cis);
      if (!ref || !exactIdentityMatch(query, [ref.nom, ref.substances_actives ?? ""].join(" "))) continue;
      return {
        url,
        sourceUrl: image.source_url,
        licence: image.licence,
        attribution: image.source_nom || null,
        title: [ref.nom, image.libelle_presentation].filter(Boolean).join(" — "),
        kind: "boite",
        provider: "catalogue_local_verifie"
      };
    }
  } catch {
    // La source locale est facultative : on poursuit avec la recherche externe.
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

  // Une photo locale vérifiée reste prioritaire, mais ne doit pas empêcher
  // la récupération de la seconde vue (forme pharmaceutique) depuis une source libre.
  const [localPhoto, externalPhotos] = await Promise.all([
    verifiedLocalPhoto(query),
    rechercherPhotosMedicament(query)
  ]);
  const photos = {
    boite: localPhoto?.kind === "boite" ? localPhoto : externalPhotos.boite,
    comprime: localPhoto?.kind === "comprime" ? localPhoto : externalPhotos.comprime
  };
  const selected = photos.boite ?? photos.comprime;
  const sources = [...new Set(
    [photos.boite?.provider, photos.comprime?.provider].filter((value): value is string => Boolean(value))
  )];
  return NextResponse.json({
    photo: selected,
    photos,
    source: selected?.provider ?? "aucune_source_gratuite_trouvee",
    sources
  }, {
    headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" }
  });
}
