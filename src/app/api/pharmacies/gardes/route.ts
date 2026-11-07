import { NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 60;

type VerifiedDutyRow = {
  id: string;
  nom: string;
  ville: string | null;
  region: string | null;
  quartier: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  photo_verified_at: string | null;
  garde_debut: string;
  garde_fin: string;
  garde_source_url: string;
  garde_verifiee_le: string;
};

function dateLisible(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Douala",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function GET() {
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const verificationMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabasePublic(30)
      .from("pharmacies")
      .select("id,nom,ville,region,quartier,adresse,lat,lng,photo_url,photo_verified_at,garde_debut,garde_fin,garde_source_url,garde_verifiee_le")
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
    const pharmacies = ((data ?? []) as VerifiedDutyRow[]).map((row) => {
      const photoUrl = row.photo_url && row.photo_verified_at
        && base && row.photo_url.startsWith(`${base}/storage/v1/object/public/pharmacies-photos/`)
        ? row.photo_url : null;
      return {
        id: row.id,
        nom: row.nom,
        quartier: row.quartier || row.adresse || row.ville,
        telephone: null,
        autresTelephones: [],
        imageUrl: photoUrl,
        imageType: photoUrl ? "photo-verifiee" as const : undefined,
        periode: `${dateLisible(row.garde_debut)} au ${dateLisible(row.garde_fin)}`,
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
