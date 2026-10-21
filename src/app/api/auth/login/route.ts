import { NextRequest, NextResponse } from "next/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";
import { clearPharmacyCookie, readPharmacyCookie } from "@/lib/pharmacie-code-session";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";
import { rateLimit, tooManyAttempts, trustedRequestIp } from "@/lib/pharmacie-rate-limit";

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
      const ipGate = await rateLimit("ip_login", loginIp, "attempt", 5, 600, 30, 900);
      if (!ipGate.allowed) return tooManyAttempts(ipGate.retryAfter);
      const userGate = await rateLimit("login_user", loginKey, "attempt", 20, 3600, 900, 900);
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
      .select(`${S.profileIdColumn},${S.profileUsernameColumn},${S.profileActiveColumn},${S.profilePharmacyIdColumn},${S.profileRoleColumn}`)
      .ilike(S.profileUsernameColumn, username)
      .limit(2);
    if (profileLookupError || !matchingProfiles || matchingProfiles.length !== 1) {
      return NextResponse.json({ error: espacePharmacie ? "Identifiants non valides pour cette pharmacie" : "Identifiants incorrects." }, { status: 401 });
    }
    const profile = matchingProfiles[0] as Record<string, unknown>;
    if (profile[S.profileActiveColumn] === false) {
      return NextResponse.json({ error: "Identifiants non valides pour cette pharmacie" }, { status: 401 });
    }
    if (espacePharmacie && (profile[S.profilePharmacyIdColumn] !== pharmacyId || !["pharmacie", "promoteur", "caisse"].includes(String(profile[S.profileRoleColumn])))) {
      return NextResponse.json({ error: "Identifiants non valides pour cette pharmacie" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin().auth.admin.getUserById(String(profile[S.profileIdColumn]));
    const email = userData.user?.email;

    if (userError || !email || !userData.user
      || !isFinalizedNaxaProfile(
        { id: String(profile[S.profileIdColumn]), username: String(profile[S.profileUsernameColumn] ?? "") },
        userData.user,
      )) {
      return NextResponse.json({ error: espacePharmacie ? "Identifiants non valides pour cette pharmacie" : "Identifiants incorrects." }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
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
