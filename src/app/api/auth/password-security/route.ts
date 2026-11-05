import { NextResponse } from "next/server";
import { checkPwnedPassword } from "@/lib/auth/pwned-passwords";
import { rateLimit, tooManyAttempts, trustedRequestIp } from "@/lib/pharmacie-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Demande invalide." }, { status: 400 });
  }

  const password = body && typeof body === "object" && "password" in body
    ? (body as { password?: unknown }).password
    : null;

  if (typeof password !== "string" || password.length === 0 || password.length > 1024) {
    return NextResponse.json({ ok: false, error: "Mot de passe invalide." }, { status: 400 });
  }

  try {
    const ip = trustedRequestIp(request);
    const gate = await rateLimit("ip_password", ip, "attempt", 5, 600, 30, 900);
    if (!gate.allowed) return tooManyAttempts(gate.retryAfter);
  } catch {
    return NextResponse.json({
      ok: false,
      code: "PASSWORD_CHECK_UNAVAILABLE",
      error: "La vérification de sécurité est momentanément indisponible. Réessayez.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await checkPwnedPassword(password);
    if (result.compromised) {
      return NextResponse.json({
        ok: false,
        code: "PASSWORD_COMPROMISED",
        error: "Ce mot de passe apparaît dans des fuites connues. Choisissez-en un autre.",
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Fail closed: no password change is allowed when the security check cannot
    // be completed. Never log the submitted password or its hash.
    return NextResponse.json({
      ok: false,
      code: "PASSWORD_CHECK_UNAVAILABLE",
      error: "La vérification de sécurité est momentanément indisponible. Réessayez.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
