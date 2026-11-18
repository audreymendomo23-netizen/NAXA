import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";
import { rateLimit, tooManyAttempts, trustedRequestIp } from "@/lib/pharmacie-rate-limit";

const GENERIC = "Si ce nom d'utilisateur existe, un code OTP a été envoyé à l'adresse e-mail associée.";
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

function genericResponse() {
  return NextResponse.json(
    { ok: true, message: GENERIC },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 2048) {
      return NextResponse.json({ ok: false, error: "Demande invalide." }, { status: 413 });
    }

    const body = await request.json();
    const username = String(body?.username ?? "").trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) return genericResponse();

    // Limit by source IP before account lookup to reduce account enumeration.
    const ip = trustedRequestIp(request);
    const ipGate = await rateLimit("ip_password_reset", ip, "attempt", 5, 600, 60, 900);
    if (!ipGate.allowed) return tooManyAttempts(ipGate.retryAfter);

    const admin = supabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, username")
      .eq("username", username)
      .maybeSingle();

    if (profileError) {
      console.error("NAXA_PASSWORD_RESET_PROFILE_LOOKUP_FAILED");
      return NextResponse.json(
        { ok: false, error: "Service momentanément indisponible. Réessayez." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!profile) return genericResponse();

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || !userData.user?.email || !isFinalizedNaxaProfile(profile, userData.user)) {
      return genericResponse();
    }

    const { error } = await admin.auth.signInWithOtp({
      email: userData.user.email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      // Keep the public result identical even when the provider rejects an OTP.
      console.error("NAXA_PASSWORD_RESET_OTP_FAILED", { code: error.code, status: error.status });
    }

    return genericResponse();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Service momentanément indisponible. Réessayez." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
