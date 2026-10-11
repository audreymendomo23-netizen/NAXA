import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

const GENERIC = "Si ce nom d'utilisateur existe, un code OTP a été envoyé à l'adresse e-mail associée.";
const NOT_FOUND = "Aucun compte NAXA ne correspond à ce nom d'utilisateur.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
      return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 404 });
    }

    const cookieName = `naxa_forgot_otp_${createHash("sha256").update(username).digest("hex").slice(0,20)}`;
    if (request.cookies.get(cookieName)?.value === "1") return NextResponse.json({ ok: false, error: "Attendez la fin des 40 secondes avant de demander un nouveau code.", retryAfter: 40 }, { status: 429 });

    const { data: profile, error: profileError } = await supabaseAdmin()
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (profileError) {
      console.error("password reset profile lookup:", profileError.message);
      return NextResponse.json({ ok: false, error: "Impossible de vérifier ce compte. Réessayez." }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 404 });
    }

    const { data: userData, error: userError } = await supabaseAdmin().auth.admin.getUserById(profile.id);
    if (userError || !userData.user?.email) {
      console.error("password reset auth lookup:", userError?.message ?? "email missing");
      return NextResponse.json({ ok: false, error: "Impossible de vérifier ce compte. Réessayez." }, { status: 500 });
    }

    const { error } = await supabaseAdmin().auth.signInWithOtp({
      email: userData.user.email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      console.error("password reset OTP:", error.message);
      return NextResponse.json({ ok: false, error: "Impossible d'envoyer le code OTP. Réessayez." }, { status: 500 });
    }

    const response = NextResponse.json({ ok: true, message: GENERIC });
    response.cookies.set(cookieName, "1", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 40 });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Impossible de vérifier ce compte. Réessayez." }, { status: 500 });
  }
}