import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { rateLimit, tooManyAttempts, trustedRequestIp } from "@/lib/pharmacie-rate-limit";
import { checkPwnedPassword } from "@/lib/auth/pwned-passwords";

export async function POST(request: NextRequest) {
  try {
    const server = supabaseServer();
    const { data: auth, error: authError } = await server.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,role,actif")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError || !profile || profile.role !== "promoteur" || profile.actif !== true) {
      return NextResponse.json({ error: "Ce compte ne peut pas modifier ce mot de passe." }, { status: 403 });
    }

    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (!currentPassword || newPassword.length < 8 || newPassword.length > 1024) {
      return NextResponse.json({
        error: "Mot de passe actuel requis et nouveau mot de passe de 8 caractères minimum.",
      }, { status: 400 });
    }

    const ip = trustedRequestIp(request);
    const userKey = "password:" + auth.user.id;
    const ipGate = await rateLimit("ip_password", ip, "attempt", 5, 600, 30, 900);
    if (!ipGate.allowed) return tooManyAttempts(ipGate.retryAfter);
    const userGate = await rateLimit("password_user", userKey, "attempt", 20, 3600, 900, 900);
    if (!userGate.allowed) return tooManyAttempts(userGate.retryAfter);

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(auth.user.id);
    const email = userData.user?.email;
    const { error: verifyError } = email
      ? await server.auth.signInWithPassword({ email, password: currentPassword })
      : { error: new Error("Invalid user") };
    if (userError || !email || verifyError) {
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

    const { error: updateError } = await admin.auth.admin.updateUserById(auth.user.id, { password: newPassword });
    if (updateError) {
      return NextResponse.json({ error: "Mise à jour du mot de passe impossible." }, { status: 500 });
    }

    await rateLimit("ip_password", ip, "success", 5, 600, 30, 900);
    await rateLimit("password_user", userKey, "success", 20, 3600, 900, 900);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Mise à jour momentanément indisponible." }, { status: 503 });
  }
}
