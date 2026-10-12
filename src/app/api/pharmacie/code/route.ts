import { NextRequest, NextResponse } from "next/server";
import { setPharmacyCookie } from "@/lib/pharmacie-code-session";
import { tooManyAttempts } from "@/lib/pharmacie-rate-limit";

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !publicKey) throw new Error("Supabase public configuration missing");

    const upstream = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/functions/v1/naxa-pharmacy-code`,
      {
        method: "POST",
        headers: {
          apikey: publicKey,
          Authorization: `Bearer ${publicKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
        cache: "no-store",
      },
    );

    const result = await upstream.json().catch(() => null);
    if (upstream.status === 429) {
      return tooManyAttempts(Number(result?.retry_after || upstream.headers.get("Retry-After") || 1));
    }
    if (upstream.status === 404) {
      return NextResponse.json({ error: "Code pharmacie introuvable." }, { status: 404 });
    }
    if (!upstream.ok) {
      console.error("NAXA_PHARMACY_CODE_FAILED", { status: upstream.status });
      return NextResponse.json({ error: "Vérification indisponible." }, { status: 503 });
    }
    if (typeof result?.pharmacy_id !== "string" || typeof result?.nom !== "string") {
      throw new Error("Invalid pharmacy code response");
    }

    const response = NextResponse.json({ nom: result.nom });
    setPharmacyCookie(response, result.pharmacy_id);
    return response;
  } catch (error) {
    console.error("NAXA_PHARMACY_CODE_FAILED", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Vérification indisponible." }, { status: 503 });
  }
}
