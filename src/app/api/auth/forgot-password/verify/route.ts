import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";
import { hasAvailableSessionSlot, MAX_CONCURRENT_SESSIONS } from "@/lib/auth/session-limit";

export async function POST(request: Request) {
  try {
    const { username, token } = await request.json();
    const normalized = String(username ?? "").trim().toLowerCase();
    const code = String(token ?? "").trim();

    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(normalized) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin()
      .from("profiles")
      .select("id, username")
      .ilike("username", normalized)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 400 });

    const { data: userData } = await supabaseAdmin().auth.admin.getUserById(profile.id);
    const email = userData.user?.email;
    if (!email || !isFinalizedNaxaProfile(profile, userData.user)) {
      return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 400 });
    }

    try {
      if (!(await hasAvailableSessionSlot(profile.id))) {
        return NextResponse.json({ error: `Ce compte est déjà connecté sur ${MAX_CONCURRENT_SESSIONS} appareils. Déconnectez-vous d’un appareil avant de vérifier le code. Le code n’a pas été consommé.` }, { status: 429 });
      }
    } catch (sessionCountError) {
      console.error("password reset OTP session preflight failed", sessionCountError instanceof Error ? sessionCountError.message : "unknown");
    }

    const response = NextResponse.json({ ok: true });
    const supabase = supabaseServer(response);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

    if (error || !data.session) {
      if (error) console.error("password reset OTP verification failed", { code: error.code, status: error.status, message: error.message });
      if (error?.message?.includes("NAXA_SESSION_LIMIT_REACHED") || (error?.code === "unexpected_failure" && error.status === 500)) {
        return NextResponse.json({ error: `Supabase refuse de créer la session : la limite de ${MAX_CONCURRENT_SESSIONS} sessions actives est atteinte. Déconnectez un appareil puis demandez un nouveau code.` }, { status: 429 });
      }
      return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 400 });
    }

    return response;
  } catch {
    return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 400 });
  }
}
