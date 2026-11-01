import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const YAOUNDE_BBOX = "(3.70,11.35,3.95,11.65)";
const MAX_CANDIDATES = 500;

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normaliserNom(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr")
        .replace(/[^a-z0-9]+/g, " ").trim()
    : "";
}

function coordonnees(element: OsmElement) {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
    || (lat as number) < 3.65 || (lat as number) > 4.0
    || (lng as number) < 11.3 || (lng as number) > 11.7) return null;
  return { lat: lat as number, lng: lng as number };
}

async function adminContext() {
  const auth = supabaseServer();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { error: jsonError("Authentification requise.", 401) };
  const { data: isAdmin, error: roleError } = await auth.rpc("is_admin");
  if (roleError || isAdmin !== true) return { error: jsonError("Accès réservé à l’administrateur NAXA.", 403) };
  return { user };
}

/**
 * Importation contrôlée depuis OpenStreetMap :
 * - uniquement des candidats d'annuaire, jamais de création de partenaire ;
 * - les coordonnées existantes ne sont jamais écrasées ;
 * - seuls les noms normalisés identiques sont rapprochés ;
 * - l'attribution OpenStreetMap reste attachée à chaque entrée.
 */
export async function POST() {
  const context = await adminContext();
  if ("error" in context) return context.error;

  const db = supabaseAdmin();
  // PostgreSQL claims the 24-hour slot atomically; a read-then-write check
  // would allow concurrent requests to start duplicate imports.
  const { data: claimed, error: claimError } = await db.rpc("admin_try_start_pharmacies_geo_osm_sync");
  if (claimError) {
    return jsonError(
      "Verrouillage OSM indisponible : vérifiez que la migration atomique de géolocalisation est appliquée.",
      503,
    );
  }
  if (claimed !== true) {
    const { data: cooldown, error: cooldownError } = await db
      .from("pharmacies_geo_osm_sync")
      .select("last_started_at")
      .eq("id", true)
      .maybeSingle();
    if (cooldownError) return jsonError("État de synchronisation OSM indisponible.", 503);
    const lastStarted = cooldown?.last_started_at ? Date.parse(cooldown.last_started_at) : 0;
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: "Une synchronisation OSM a déjà été lancée dans les dernières 24 heures.",
      nextAllowedAt: lastStarted
        ? new Date(lastStarted + 24 * 60 * 60 * 1000).toISOString()
        : null,
    });
  }

  const startedAt = new Date().toISOString();

  try {
    const query = `[out:json][timeout:25];(node["amenity"="pharmacy"]${YAOUNDE_BBOX};way["amenity"="pharmacy"]${YAOUNDE_BBOX};relation["amenity"="pharmacy"]${YAOUNDE_BBOX};);out center tags;`;
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": "NAXA-pharmacy-directory/1.0 (https://naxa-naxa3.vercel.app; contact: naxa.home@gmail.com)",
        "accept": "application/json",
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`OpenStreetMap Overpass HTTP ${response.status}`);
    const payload = await response.json() as { elements?: OsmElement[] };
    const elements = (payload.elements ?? []).slice(0, MAX_CANDIDATES);
    const candidates = elements.flatMap((element) => {
      const name = element.tags?.name?.trim();
      const position = coordonnees(element);
      if (!name || !position) return [];
      if (element.tags?.healthcare === "veterinary" || element.tags?.veterinary === "yes"
        || /vétérinaire|veterinary/i.test(name)) return [];
      const osmUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
      return [{
        nom_source: name.slice(0, 250),
        ville: "Yaoundé",
        quartier: element.tags?.["addr:suburb"] ?? element.tags?.["addr:neighbourhood"] ?? element.tags?.["addr:district"] ?? null,
        latitude: position.lat,
        longitude: position.lng,
        categorie: "pharmacie_humaine" as const,
        source_url: osmUrl,
        source_annee: null,
        source_reference: `OpenStreetMap ${element.type}/${element.id}; © OpenStreetMap contributors (ODbL)`,
        statut: "a_confirmer" as const,
        collecte_le: new Date().toISOString().slice(0, 10),
        updated_at: startedAt,
      }];
    });

    if (candidates.length) {
      const { error } = await db.from("pharmacies_geolocalisation_referentiel")
        .upsert(candidates, { onConflict: "nom_source,source_url" });
      if (error) throw new Error("Échec d'enregistrement du référentiel OSM : " + error.message);
    }

    const { data: pharmacies, error: pharmaciesError } = await db.from("pharmacies")
      .select("id,nom,ville,lat,lng")
      .ilike("ville", "%Yaound%")
      .limit(5000);
    if (pharmaciesError) throw new Error("Lecture des pharmacies partenaires impossible : " + pharmaciesError.message);

    const byName = new Map<string, typeof candidates[number]>();
    for (const candidate of candidates) {
      const key = normaliserNom(candidate.nom_source);
      if (key && !byName.has(key)) byName.set(key, candidate);
    }

    let matched = 0;
    let skippedWithCoords = 0;
    let unmatched = 0;
    for (const pharmacy of pharmacies ?? []) {
      if (pharmacy.lat !== null || pharmacy.lng !== null) {
        skippedWithCoords++;
        continue;
      }
      const candidate = byName.get(normaliserNom(pharmacy.nom));
      if (!candidate) { unmatched++; continue; }

      // Relecture/filtre des coordonnées absentes dans l'UPDATE pour ne jamais écraser
      // une position renseignée entre la sélection et l'écriture.
      const { data: updated, error } = await db.from("pharmacies").update({
        lat: candidate.latitude,
        lng: candidate.longitude,
        geo_source_url: candidate.source_url,
        geo_statut: "source_publique_a_confirmer",
        geo_mise_a_jour: new Date().toISOString(),
      }).eq("id", pharmacy.id).is("lat", null).is("lng", null).select("id").maybeSingle();
      if (error) throw new Error("Écriture des coordonnées impossible : " + error.message);
      if (updated) matched++;
    }

    const finishedAt = new Date().toISOString();
    const { error: finishError } = await db.from("pharmacies_geo_osm_sync").update({
      last_finished_at: finishedAt,
      candidats_importes: candidates.length,
      pharmacies_rapprochees: matched,
      erreur: null,
    }).eq("id", true);
    if (finishError) {
      return jsonError("La synchronisation des données a abouti, mais son état final n’a pas pu être enregistré. Vérifiez le journal technique avant de relancer.", 503);
    }

    return NextResponse.json({
      ok: true,
      source: "OpenStreetMap / Overpass",
      attribution: "© OpenStreetMap contributors — ODbL",
      ville: "Yaoundé",
      candidatsImportes: candidates.length,
      pharmaciesPartenairesRapprochees: matched,
      pharmaciesAvecCoordonneesPreservees: skippedWithCoords,
      pharmaciesSansCorrespondanceExacte: unmatched,
      prochainesSynchronisationsApres: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      avertissement: "Les coordonnées issues d'une source publique restent à confirmer sur le terrain. Les candidats ne sont pas des partenaires NAXA.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue pendant la synchronisation OSM.";
    const { error: statusError } = await db.from("pharmacies_geo_osm_sync").update({
      last_finished_at: new Date().toISOString(),
      erreur: message.slice(0, 1000),
    }).eq("id", true);
    return jsonError(statusError
      ? `${message} L’état d’échec n’a pas non plus pu être enregistré : ${statusError.message}`
      : message, 502);
  }
}

export async function GET() {
  const context = await adminContext();
  if ("error" in context) return context.error;
  const db = supabaseAdmin();
  const [{ data: sync, error: syncError }, { count: pending, error: pendingError }, { count: missing, error: missingError }] = await Promise.all([
    db.from("pharmacies_geo_osm_sync").select("*").eq("id", true).maybeSingle(),
    db.from("pharmacies_geolocalisation_referentiel").select("id", { count: "exact", head: true }).eq("statut", "a_confirmer"),
    db.from("pharmacies").select("id", { count: "exact", head: true }).ilike("ville", "%Yaound%").or("lat.is.null,lng.is.null"),
  ]);
  if (syncError || pendingError || missingError) {
    return jsonError("Référentiel OSM indisponible : appliquez la migration 072 et vérifiez les droits Supabase.", 503);
  }
  return NextResponse.json({
    ok: true,
    derniereSynchronisation: sync?.last_finished_at ?? null,
    candidatsAConfirmer: pending ?? 0,
    pharmaciesPartenairesSansCoordonnees: missing ?? 0,
    dernierResultat: sync ? {
      candidatsImportes: sync.candidats_importes,
      pharmaciesRapprochees: sync.pharmacies_rapprochees,
      erreur: sync.erreur,
    } : null,
    attribution: "© OpenStreetMap contributors — ODbL",
  });
}
