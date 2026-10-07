import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { hasAvailableSessionSlot, MAX_CONCURRENT_SESSIONS } from "@/lib/auth/session-limit";

function requestIp(request: Request): string | null {
  const candidate = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip")?.trim() ?? null;
  return candidate && isIP(candidate) ? candidate : null;
}
async function auditSessionLimitRejected(request: Request, profile: { id: string; pharmacie_id?: string | null }, provider: string) {
  try {
    await supabaseAdmin().rpc("naxa_record_session_limit_rejected", {
      p_session_id: crypto.randomUUID(), p_user_id: profile.id, p_pharmacie_id: profile.pharmacie_id ?? null,
      p_ip_address: requestIp(request), p_user_agent: request.headers.get("user-agent"), p_provider: provider,
    });
  } catch (auditError) {
    console.error("NAXA_SESSION_LIMIT_AUDIT_FAILED", auditError);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json({ error: "Nom d'utilisateur et mot de passe requis." }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin()
      .from("profiles")
      .select("id,actif,pharmacie_id")
      .ilike("username", username)
      .maybeSingle();

    if (!profile || profile.actif === false) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin().auth.admin.getUserById(profile.id);
    const email = userData.user?.email;

    if (userError || !email) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    if (!(await hasAvailableSessionSlot(profile.id))) {
      await auditSessionLimitRejected(request, profile, "password");
      return NextResponse.json(
        { error: `Ce compte est déjà connecté sur ${MAX_CONCURRENT_SESSIONS} appareils. Déconnectez-vous d'un appareil avant de vous connecter ici.` },
        { status: 429 }
      );
    }

    const supabase = supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message?.includes("NAXA_SESSION_LIMIT_REACHED")) {
        await auditSessionLimitRejected(request, profile, "password");
        return NextResponse.json(
          { error: `Ce compte est déjà connecté sur ${MAX_CONCURRENT_SESSIONS} appareils. Déconnectez-vous d'un appareil avant de vous connecter ici.` },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Connexion momentanément indisponible." }, { status: 500 });
  }
}
