import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";
import { setPharmacyCookie } from "@/lib/pharmacie-code-session";

// Limitation de secours en mémoire (par instance Preview; ne remplace pas un rate limiter partagé en production).
const failures = new Map<string, { count: number; blockedUntil: number }>();
function clientKey(request: NextRequest) { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }

export async function POST(request: NextRequest) {
  const key = clientKey(request);
  const now = Date.now();
  const state = failures.get(key);
  if (state && state.blockedUntil > now) return NextResponse.json({ error: "Trop de tentatives. Réessayez dans 30 secondes." }, { status: 429 });
  let body: { code?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Code invalide." }, { status: 400 }); }
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\d{4}$/.test(code)) return NextResponse.json({ error: "Saisissez un code à 4 chiffres." }, { status: 400 });
  try {
    const { data, error } = await supabaseAdmin().from(S.pharmaciesTable)
      .select(`${S.pharmacyIdColumn},${S.pharmacyNameColumn}`)
      .eq(S.pharmacyCodeColumn, code).limit(2);
    if (error) throw error;
    if (!data || data.length !== 1) {
      const next = { count: (state?.count ?? 0) + 1, blockedUntil: 0 };
      if (next.count >= 5) { next.blockedUntil = now + 30_000; next.count = 0; }
      failures.set(key, next);
      return NextResponse.json({ error: "Code pharmacie introuvable" }, { status: 404 });
    }
    const pharmacy = data[0] as Record<string, unknown>;
    if (typeof pharmacy[S.pharmacyIdColumn] !== "string" || typeof pharmacy[S.pharmacyNameColumn] !== "string") throw new Error("Unexpected pharmacy schema");
    failures.delete(key);
    const response = NextResponse.json({ nom: pharmacy[S.pharmacyNameColumn] });
    setPharmacyCookie(response, pharmacy[S.pharmacyIdColumn] as string);
    return response;
  } catch (error) {
    console.error("NAXA_PHARMACY_CODE_LOOKUP_FAILED", error);
    return NextResponse.json({ error: "Vérification indisponible. Vérifiez le schéma et la migration sur Preview." }, { status: 500 });
  }
}
