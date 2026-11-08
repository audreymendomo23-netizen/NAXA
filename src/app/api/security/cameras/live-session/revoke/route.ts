import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { loadPromoteurAccess } from "@/lib/promoteur-access";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function response(ok: boolean, status: number) {
  return NextResponse.json({ ok }, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return response(false, 403);
    if (request.headers.get("sec-fetch-site") === "cross-site") return response(false, 403);

    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
    if (!tokenPattern.test(token)) return response(false, 400);

    const access = await loadPromoteurAccess();
    if (
      access.profile.role !== "promoteur" || access.profile.actif !== true ||
      access.shouldShowAccessStatus || access.linksError || access.pharmaciesError
    ) return response(false, 403);

    const tokenSha256 = createHash("sha256").update(token, "utf8").digest("hex");
    const db = supabaseAdmin();
    const { data: session, error: sessionError } = await db
      .from("naxa_security_live_sessions")
      .select("id,pharmacie_id")
      .eq("token_sha256", tokenSha256)
      .eq("user_id", access.profile.id)
      .eq("status", "active")
      .maybeSingle();

    if (sessionError) return response(false, 503);
    if (!session || !access.activeLinkIds.has(session.pharmacie_id)) return response(false, 404);

    const { data: revoked, error: revokeError } = await db
      .from("naxa_security_live_sessions")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", session.id)
      .eq("user_id", access.profile.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();

    if (revokeError) return response(false, 503);
    return response(Boolean(revoked), revoked ? 200 : 409);
  } catch {
    return response(false, 503);
  }
}
