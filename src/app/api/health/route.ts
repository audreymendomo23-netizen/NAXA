import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function unavailable() {
  return NextResponse.json(
    { ok: false },
    { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

/** A lightweight reachability check for the offline pharmacy workflow. */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return unavailable();

  try {
    const endpoint = url.replace(/\\/+$/, "") + "/auth/v1/health";
    const response = await fetch(endpoint, {
      headers: { apikey: key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return unavailable();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return unavailable();
  }
}
