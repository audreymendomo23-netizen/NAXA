import { NextRequest, NextResponse } from "next/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";
import { clearPharmacyCookie, readPharmacyCookie } from "@/lib/pharmacie-code-session";
import { isIP } from "node:net";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { hasAvailableSessionSlot, MAX_CONCURRENT_SESSIONS } from "@/lib/auth/session-limit";
import { rateLimit, tooManyAttempts, trustedRequestIp } from "@/lib/pharmacie-rate-limit";

function requestIp(request: Request): string | null {
  const candidate = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip")?.trim() ?? null;
  return candidate && isIP(candidate) ? candidate : null;
}

// Journalise le refus pour plafond de sessions. Ne bloque jamais la réponse :
// toute défaillance laisse une trace dans les logs serveur.
async function auditSessionLimitRejected(request: Request, profile: { id: string; pharmacie_id?: string | null }, provider: string) {
  try {
    const { error } = await supabaseAdmin().rpc("naxa_record_session_limit_rejected", {
      p_session_id: crypto.randomUUID(), p_user_id: profile.id, p_pharmacie_id: profile.pharmacie_id ?? null,
      p_ip_address: requestIp(request), p_user_agent: request.headers.get("user-agent"), p_provider: provider,
    });
    if (error) console.error("NAXA_SESSION_LIMIT_AUDIT_FAILED", error);
  } catch (auditError) {
    console.error("NAXA_SESSION_LIMIT_AUDIT_FAILED", auditError);
  }
}

// Pré-contrôle de confort (message clair). Le plafond réel reste appliqué par la base :
// si le comptage échoue, on laisse la connexion continuer et on laisse une trace.
async function sessionSlotAvailable(userId: string): Promise<boolean> {
  try {
    return await hasAvailableSessionSlot(userId);
  } catch (slotError) {
    console.error("NAXA_SESSION_COUNT_FAILED", slotError);
    return true;
  }
}

function sessionLimitResponse() {
  return NextResponse.json(
    { error: `Ce compte est déjà connecté sur ${MAX_CONCURRENT_SESSIONS} appareils. Déconnectez-vous d'un appareil avant de vous connecter ici.` },
    { status: 429 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json({ error: "Nom d'utilisateur et mot de passe requis." }, { status: 400 });
    }

    const espacePharmacie = body.espace === "pharmacie";
    const loginIp = trustedRequestIp(request);
    const loginKey = "login:" + username;
    if (espacePharmacie) {
      const ipGate = await rateLimit("ip_login", loginIp, "check", 5, 600, 30, 900);
      if (!ipGate.allowed) return tooManyAttempts(ipGate.retryAfter);
      const userGate = await rateLimit("login_user", loginKey, "check", 20, 3600, 900, 900);
      if (!userGate.allowed) return tooManyAttempts(userGate.retryAfter);
    }
    const pharmacyId = espacePharmacie ? readPharmacyCookie(request) : null;
    if (espacePharmacie && !pharmacyId) {
      const response = NextResponse.json({ error: "Session expirée, entrez de nouveau votre code", code: "PHARMACY_SESSION_EXPIRED" }, { status: 401 });
      clearPharmacyCookie(response);
      return response;
    }

    // La liaison utilisateur/pharmacie est obligatoire pour l'espace pharmacie.
    const { data: matchingProfiles, error: profileLookupError } = await supabaseAdmin()
      .from(S.profilesTable)
      .select(`${S.profileIdColumn},${S.profileActiveColumn},${S.profilePharmacyIdColumn},${S.profileRoleColumn}`)
      .ilike(S.profileUsernameColumn, username)
      .limit(2);
    if (profileLookupError || !matchingProfiles || matchingProfiles.length !== 1) {
      if (espacePharmacie) {
        const gate = await rateLimit("ip_login", loginIp, "fail", 5, 600, 30, 900);
        await rateLimit("login_user", loginKey, "fail", 20, 3600, 900, 900);
        if (!gate.allowed) return tooManyAttempts(gate.retryAfter);
      }
      return NextResponse.json({ error: espacePharmacie ? "Identifiants non valides pour cette pharmacie" : "Identifiants incorrects." }, { status: 401 });
    }
    const profile = matchingProfiles[0] as Record<string, unknown> & { id: string; actif?: boolean | null; pharmacie_id?: string | null };
    if (profile[S.profileActiveColumn] === false) {
      if (espacePharmacie) {
        const gate = await rateLimit("ip_login", loginIp, "fail", 5, 600, 30, 900);
        await rateLimit("login_user", loginKey, "fail", 20, 3600, 900, 900);
        if (!gate.allowed) return tooManyAttempts(gate.retryAfter);
      }
      return NextResponse.json({ error: "Identifiants non valides pour cette pharmacie" }, { status: 401 });
    }
    if (espacePharmacie && (profile[S.profilePharmacyIdColumn] !== pharmacyId || !["pharmacie","promoteur","caisse"].includes(String(profile[S.profileRoleColumn])))) {
      const gate = await rateLimit("ip_login", loginIp, "fail", 5, 600, 30, 900);
      await rateLimit("login_user", loginKey, "fail", 20, 3600, 900, 900);
      if (!gate.allowed) return tooManyAttempts(gate.retryAfter);
      return NextResponse.json({ error: "Identifiants non valides pour cette pharmacie" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin().auth.admin.getUserById(profile.id);
    const email = userData.user?.email;

    if (userError || !email) {
      if (espacePharmacie) {
        const gate = await rateLimit("ip_login", loginIp, "fail", 5, 600, 30, 900);
        await rateLimit("login_user", loginKey, "fail", 20, 3600, 900, 900);
        if (!gate.allowed) return tooManyAttempts(gate.retryAfter);
      }
      return NextResponse.json({ error: espacePharmacie ? "Identifiants non valides pour cette pharmacie" : "Identifiants incorrects." }, { status: 401 });
    }

    if (!(await sessionSlotAvailable(profile.id))) {
      await auditSessionLimitRejected(request, profile, "password");
      return sessionLimitResponse();
    }

    const supabase = supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (espacePharmacie) {
        const gate = await rateLimit("ip_login", loginIp, "fail", 5, 600, 30, 900);
        await rateLimit("login_user", loginKey, "fail", 20, 3600, 900, 900);
        if (!gate.allowed) return tooManyAttempts(gate.retryAfter);
      }
      if (error.message?.includes("NAXA_SESSION_LIMIT_REACHED")) {
        await auditSessionLimitRejected(request, profile, "password");
        return sessionLimitResponse();
      }
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    if (espacePharmacie) {
      await rateLimit("ip_login", loginIp, "success", 5, 600, 30, 900);
      await rateLimit("login_user", loginKey, "success", 20, 3600, 900, 900);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Connexion momentanément indisponible." }, { status: 500 });
  }
}
