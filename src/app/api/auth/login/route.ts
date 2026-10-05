import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json({ error: "Nom d'utilisateur et mot de passe requis." }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin()
      .from("profiles")
      .select("id,actif")
      .ilike("username", username)
      .maybeSingle();

    if (!profile || profile.actif === false) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin().auth.admin.getUserById(profile.id);
    const email = userData.user?.email;

    if (userError || !email) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Connexion momentanément indisponible." }, { status: 500 });
  }
}
