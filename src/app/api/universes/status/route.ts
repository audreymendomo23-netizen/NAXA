import { NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CONFIGURABLE_UNIVERSES = [
  "parapharmacie",
  "bebe-maman",
  "examens",
  "suivi",
  "prestations",
] as const;

export async function GET() {
  try {
    // The public universe registry is intentionally readable by anon.
    // Admin updates it atomically with the associated feature flags.
    const sb = supabasePublic(0);
    const { data, error } = await sb
      .from("universes")
      .select("slug,enabled")
      .in("slug", [...CONFIGURABLE_UNIVERSES]);

    if (error) {
      return NextResponse.json(
        { error: "universe_status_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rows = new Map<string, boolean>(
      (data ?? []).map((row) => [row.slug, row.enabled === true] as const),
    );
    const universes: Record<string, boolean> = { pharmacie: true };
    for (const slug of CONFIGURABLE_UNIVERSES) universes[slug] = rows.get(slug) === true;

    return NextResponse.json(
      { universes },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: "universe_status_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
