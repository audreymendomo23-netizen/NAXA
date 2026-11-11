import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

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
    const sb = supabaseAdmin();
    const [{ data: universeRows, error: universeError }, { data: flagRows, error: flagError }] = await Promise.all([
      sb.from("universes").select("slug,enabled").in("slug", [...CONFIGURABLE_UNIVERSES]),
      sb.from("feature_flags").select("flag_key,enabled").in("flag_key", [
        ...CONFIGURABLE_UNIVERSES.map((slug) => `universe.${slug}`),
        "suivi_connecte",
      ]),
    ]);

    if (universeError || flagError) {
      return NextResponse.json(
        { error: "universe_status_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const universes = new Map((universeRows ?? []).map((row) => [row.slug, row.enabled === true]));
    const flags = new Map((flagRows ?? []).map((row) => [row.flag_key, row.enabled === true]));
    const status: Record<string, boolean> = { pharmacie: true };

    for (const slug of CONFIGURABLE_UNIVERSES) {
      const enabled = universes.get(slug) === true && flags.get(`universe.${slug}`) === true;
      status[slug] = slug === "suivi"
        ? enabled && flags.get("suivi_connecte") === true
        : enabled;
    }

    return NextResponse.json(
      { universes: status },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: "universe_status_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
