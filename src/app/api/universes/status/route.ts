import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Le RPC renvoie uniquement l'état agrégé registre + feature flag.
// La table feature_flags reste inaccessible à anon.
const CONFIGURABLE_UNIVERSES = [
  "parapharmacie",
  "bebe-maman",
  "examens",
  "suivi",
  "prestations",
] as const;

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new Error("public_supabase_not_configured");

    const response = await fetch(
      new URL("/rest/v1/rpc/get_universe_public_status", supabaseUrl),
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("universe_status_unavailable");

    const payload: unknown = await response.json();
    const rows = Array.isArray(payload) ? payload : [];
    const states = new Map<string, boolean>(
      rows.flatMap((row): [string, boolean][] =>
        row && typeof row === "object"
          && "slug" in row && typeof row.slug === "string"
          && "enabled" in row && typeof row.enabled === "boolean"
          ? [[row.slug, row.enabled]]
          : []
      ),
    );

    const suiviEnabled = states.get("suivi") === true;
    const universes: Record<string, boolean> = {
      pharmacie: true,
      parapharmacie: states.get("parapharmacie") === true,
      "bebe-maman": states.get("bebe-maman") === true,
      examens: states.get("examens") === true,
      prestations: states.get("prestations") === true,
      dispositifs: suiviEnabled,
      suivi: suiviEnabled,
    };

    // Un slug absent du RPC reste fermé, y compris si l'API répond 200.
    for (const slug of CONFIGURABLE_UNIVERSES) {
      if (!states.has(slug)) universes[slug] = false;
    }

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
