import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";
import { clearPharmacyCookie, readPharmacyCookie } from "@/lib/pharmacie-code-session";
import { rateLimit, tooManyAttempts, trustedRequestIp } from "@/lib/pharmacie-rate-limit";
import { checkPwnedPassword } from "@/lib/auth/pwned-passwords";

export async function POST(request: NextRequest) {
  const pharmacyId = readPharmacyCookie(request);
  if (!pharmacyId) {
    const response = NextResponse.json({ error: "Session expirée, entrez de nouveau votre code", code: "PHARMACY_SESSION_EXPIRED" }, { status: 401 });
    clearPharmacyCookie(response); return response;
  }
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (!username || !currentPassword || newPassword.length < 8) return NextResponse.json({ error: "Nom d'utilisateur, mot de passe actuel et nouveau mot de passe (8 caractères minimum) requis." }, { status: 400 });
    const ip = trustedRequestIp(request), userKey = "password:" + username;
    const ipGate = await rateLimit("ip_password", ip, "attempt", 5, 600, 30, 900);
    if (!ipGate.allowed) return tooManyAttempts(ipGate.retryAfter);
    const userGate = await rateLimit("password_user", userKey, "attempt", 20, 3600, 900, 900);
    if (!userGate.allowed) return tooManyAttempts(userGate.retryAfter);

    const { data: profiles, error: profileError } = await supabaseAdmin().from(S.profilesTable)
      .select(`${S.profileIdColumn},${S.profilePharmacyIdColumn},${S.profileUsernameColumn},${S.profileActiveColumn},${S.profileRoleColumn}`)
      .ilike(S.profileUsernameColumn, username).limit(2);
    if (profileError || !profiles || profiles.length !== 1 || profiles[0][S.profilePharmacyIdColumn] !== pharmacyId || profiles[0][S.profileActiveColumn] === false || !["pharmacie","promoteur","caisse"].includes(String(profiles[0][S.profileRoleColumn]))) {
      return NextResponse.json({ error: "Identifiants non valides pour cette pharmacie" }, { status: 401 });
    }
    const userId = String(profiles[0][S.profileIdColumn]);
    const { data: userData, error: userError } = await supabaseAdmin().auth.admin.getUserById(userId);
    const email = userData.user?.email;
    const { error: authError } = email
      ? await supabaseServer().auth.signInWithPassword({ email, password: currentPassword })
      : { error: new Error("Invalid user") };
    if (userError || !email || authError) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 401 });
    }
    let passwordCheck: { compromised: boolean; prevalence: number };
    try {
      passwordCheck = await checkPwnedPassword(newPassword);
    } catch {
      return NextResponse.json({
        error: "La vérification de sécurité du mot de passe est indisponible. Réessayez.",
        code: "PASSWORD_CHECK_UNAVAILABLE",
      }, { status: 503 });
    }
    if (passwordCheck.compromised) {
      return NextResponse.json({
        error: "Ce mot de passe apparaît dans des fuites connues. Choisissez-en un autre.",
        code: "PASSWORD_COMPROMISED",
      }, { status: 409 });
    }

    const { error: updateError } = await supabaseAdmin().auth.admin.updateUserById(userId, { password: newPassword });
    if (updateError) return NextResponse.json({ error: "Mise à jour du mot de passe impossible." }, { status: 500 });
    await rateLimit("ip_password", ip, "success", 5, 600, 30, 900);
    await rateLimit("password_user", userKey, "success", 20, 3600, 900, 900);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("NAXA_PHARMACY_PASSWORD_UPDATE_FAILED", error);
    return NextResponse.json({ error: "Mise à jour momentanément indisponible." }, { status: 503 });
  }
}
