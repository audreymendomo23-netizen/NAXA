import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { checkPwnedPassword } from "@/lib/auth/pwned-passwords";
import { rateLimit, tooManyAttempts, trustedRequestIp } from "@/lib/pharmacie-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Demande invalide." }, { status: 400 });
  }

  const password = body && typeof body === "object" && "password" in body
    ? (body as { password?: unknown }).password
    : null;
  if (typeof password !== "string" || password.length < 6 || password.length > 1024
    || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return NextResponse.json({
      ok: false,
      error: "Le mot de passe doit contenir au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.",
    }, { status: 400 });
  }

  try {
    const server = supabaseServer();
    const { data: auth, error: authError } = await server.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ ok: false, error: "Session expirée. Recommencez la vérification." }, { status: 401 });
    }
    if (!auth.user.email_confirmed_at) {
      return NextResponse.json({ ok: false, error: "Confirmez d’abord votre adresse e-mail." }, { status: 403 });
    }

    const ip = trustedRequestIp(request);
    const userKey = "password:" + auth.user.id;
    const ipGate = await rateLimit("ip_password", ip, "attempt", 5, 600, 30, 900);
    if (!ipGate.allowed) return tooManyAttempts(ipGate.retryAfter);
    const userGate = await rateLimit("password_user", userKey, "attempt", 20, 3600, 900, 900);
    if (!userGate.allowed) return tooManyAttempts(userGate.retryAfter);

    let passwordCheck: { compromised: boolean; prevalence: number };
    try {
      passwordCheck = await checkPwnedPassword(password);
    } catch {
      return NextResponse.json({
        ok: false,
        code: "PASSWORD_CHECK_UNAVAILABLE",
        error: "La vérification de sécurité du mot de passe est indisponible. Réessayez.",
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    if (passwordCheck.compromised) {
      return NextResponse.json({
        ok: false,
        code: "PASSWORD_COMPROMISED",
        error: "Ce mot de passe apparaît dans des fuites connues. Choisissez-en un autre.",
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    const { error: updateError } = await server.auth.updateUser({ password });
    if (updateError) {
      return NextResponse.json({ ok: false, error: "Impossible d’enregistrer le mot de passe." }, { status: 500 });
    }

    // A password reset is a security boundary: revoke every refresh session
    // from the server before returning success. Do not rely on a follow-up
    // browser request that can be interrupted after the password was changed.
    const { error: revokeError } = await server.auth.signOut({ scope: "global" });
    if (revokeError) {
      console.error("NAXA_PASSWORD_RESET_GLOBAL_SIGNOUT_FAILED", {
        errorCode: revokeError.code || "unknown",
        status: revokeError.status || 0,
      });
      return NextResponse.json({
        ok: true,
        sessionsRevoked: false,
        warning: "Mot de passe changé, mais la déconnexion des autres appareils n’a pas pu être confirmée.",
      }, { headers: { "Cache-Control": "no-store" } });
    }

    await rateLimit("ip_password", ip, "success", 5, 600, 30, 900);
    await rateLimit("password_user", userKey, "success", 20, 3600, 900, 900);
    return NextResponse.json({ ok: true, sessionsRevoked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NAXA_USER_PASSWORD_UPDATE_FAILED", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      ...(typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? { errorCode: error.code }
        : {}),
    });
    return NextResponse.json({
      ok: false,
      code: "PASSWORD_UPDATE_UNAVAILABLE",
      error: "Mise à jour du mot de passe momentanément indisponible. Réessayez.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
