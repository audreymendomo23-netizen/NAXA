import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const GENERIC = "Si ce nom d'utilisateur existe, un code OTP a été envoyé à l'adresse e-mail associée.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) return NextResponse.json({ ok: true, message: GENERIC });

    const { data: profile, error: profileError } = await supabaseAdmin()
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (profileError) {\n      console.error("password reset profile lookup:", profileError.message);\n      return NextResponse.json({ ok: false, error: "Impossible de vérifier ce compte. Réessayez." }, { status: 500 });\n    }\n\n    if (!profile) return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 404 });\n\n    {
      const { data: userData } = await supabaseAdmin().auth.admin.getUserById(profile.id);
      const email = userData.user?.email;
      if (email) {
        const { error } = await supabaseAdmin().auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error) console.error("password reset OTP:", error.message);
      }
    }

    return NextResponse.json({ ok: true, message: GENERIC });
  } catch {
    return NextResponse.json({ ok: true, message: GENERIC });
  }
}