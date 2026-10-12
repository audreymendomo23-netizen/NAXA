import { NextRequest, NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";
import { setPharmacyCookie } from "@/lib/pharmacie-code-session";
import { hashRateKey, tooManyAttempts, trustedRequestIp } from "@/lib/pharmacie-rate-limit";

export async function POST(request: NextRequest) {
  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Code invalide." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json({ error: "Code invalide." }, { status: 400 });
  }

  try {
    const { data, error } = await supabasePublic().rpc("naxa_validate_pharmacy_code_v1", {
      p_code: code,
      p_ip_hash: hashRateKey(trustedRequestIp(request)),
      p_code_hash: hashRateKey(code),
    });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : null;
    if (result?.status === "rate_limited") {
      return tooManyAttempts(Number(result.retry_after || 1));
    }
    if (result?.status === "not_found") {
      return NextResponse.json({ error: "Code pharmacie introuvable." }, { status: 404 });
    }
    if (
      result?.status !== "ok" ||
      typeof result.pharmacy_id !== "string" ||
      typeof result.pharmacy_name !== "string"
    ) {
      throw new Error("Invalid pharmacy code RPC response");
    }

    const response = NextResponse.json({ nom: result.pharmacy_name });
    setPharmacyCookie(response, result.pharmacy_id);
    return response;
  } catch (error) {
    console.error("NAXA_PHARMACY_CODE_FAILED", error);
    return NextResponse.json({ error: "Vérification indisponible." }, { status: 503 });
  }
}
