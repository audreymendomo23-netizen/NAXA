import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const { data: profile } = await supabaseAdmin()
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (profile) {
      const { data: userData } = await supabaseAdmin().auth.admin.getUserById(profile.id);
      if (userData.user?.email) {
        const origin = new URL(request.url).origin;
        await supabaseServer().auth.resetPasswordForEmail(userData.user.email, {
          redirectTo: `${origin}/nouveau-mot-de-passe`,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Si ce nom d'utilisateur existe, un e-mail de récupération a été envoyé.",
    });
  } catch {
    return NextResponse.json({
      ok: true,
      message: "Si ce nom d'utilisateur existe, un e-mail de récupération a été envoyé.",
    });
  }
}
