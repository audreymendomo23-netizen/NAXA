import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const COOLDOWN_SECONDS = 40;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const mode = String(body.mode ?? "resend");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["start", "resend"].includes(mode)) {
      return NextResponse.json({ ok: false, error: "Demande invalide." }, { status: 400 });
    }

    const cookieName = `naxa_signup_otp_${createHash("sha256").update(email).digest("hex").slice(0, 20)}`;
    if (mode === "resend" && request.cookies.get(cookieName)?.value === "1") {
      return NextResponse.json({
        ok: false,
        error: "Attendez la fin des 40 secondes avant de demander un nouveau code.",
        retryAfter: COOLDOWN_SECONDS,
      }, { status: 429 });
    }

    if (mode === "resend") {
      const { error } = await supabaseAdmin().auth.resend({ type: "signup", email });
      if (error) {
        console.error("signup OTP resend:", error.message);
        return NextResponse.json({ ok: false, error: "Impossible de renvoyer le code OTP. Réessayez plus tard." }, { status: 502 });
      }
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookieName, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: COOLDOWN_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Impossible de traiter la demande OTP." }, { status: 500 });
  }
}
