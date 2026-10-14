import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";

const GENERIC = "Si ce nom d'utilisateur existe, un code OTP a été envoyé à l'adresse e-mail associée.";
const NOT_FOUND = "Aucun compte NAXA ne correspond à ce nom d'utilisateur.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
      return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 404 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin()
      .from("profiles")
      .select("id, username")
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
    if (!isFinalizedNaxaProfile(profile, userData.user)) {
      return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 404 });
    }

    const { error } = await supabaseAdmin().auth.signInWithOtp({
      email: userData.user.email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      console.error("password reset OTP:", error.message);
      return NextResponse.json({ ok: false, error: "Impossible d'envoyer le code OTP. Réessayez." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: GENERIC });
  } catch {
    return NextResponse.json({ ok: false, error: "Impossible de vérifier ce compte. Réessayez." }, { status: 500 });
  }
}