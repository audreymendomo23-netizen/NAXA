import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!accessToken) return NextResponse.json({ error:"Reconnectez-vous pour demander la suppression du compte." }, { status:401 });
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== "SUPPRIMER" || typeof body.password !== "string" || !body.password) {
      return NextResponse.json({ error:"Saisissez le mot de passe du compte et confirmez la suppression." }, { status:400 });
    }
    const admin = supabaseAdmin();
    const { data, error: authError } = await admin.auth.getUser(accessToken);
    const user = data.user;
    if (authError || !user?.email) return NextResponse.json({ error:"Session invalide. Reconnectez-vous puis réessayez." }, { status:401 });
    const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) {
      console.error("NAXA_ACCOUNT_DELETE_PROFILE_CHECK_FAILED", profileError.message);
      return NextResponse.json({ error:"Impossible de vérifier le type de compte. Réessayez plus tard." }, { status:503 });
    }
    if (profile?.role !== "client") return NextResponse.json({ error:"Cette fonction est réservée aux comptes clients." }, { status:403 });

    const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }
    });
    const { error: passwordError } = await verifier.auth.signInWithPassword({ email:user.email, password:body.password });
    if (passwordError) return NextResponse.json({ error:"Mot de passe incorrect. Votre compte n’a pas été supprimé." }, { status:403 });

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("NAXA_CLIENT_ACCOUNT_DELETE_FAILED", deleteError.message);
      return NextResponse.json({ error:"La suppression n’a pas abouti. Votre compte n’a pas été confirmé comme supprimé." }, { status:503 });
    }
    return NextResponse.json({ ok:true });
  } catch (error) {
    console.error("NAXA_CLIENT_ACCOUNT_DELETE_UNAVAILABLE", error);
    return NextResponse.json({ error:"Service de suppression momentanément indisponible." }, { status:503 });
  }
}
