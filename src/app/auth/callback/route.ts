import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/connexion?erreur=oauth", url.origin));
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  const supabase = supabaseServer(response);
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(new URL("/connexion?erreur=oauth", url.origin));
  }

  const { data: auth, error: userError } = await supabase.auth.getUser();
  if (userError || !auth.user) {
    return NextResponse.redirect(new URL("/connexion?erreur=oauth", url.origin));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,username,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.redirect(new URL("/connexion?erreur=oauth", url.origin));
  }

  const incomplete = !profile
    || !profile.username
    || !profile.first_name
    || !profile.last_name
    || !profile.phone
    || !profile.date_of_birth
    || !profile.age_verified
    || !profile.consent_accepted_at;

  if (incomplete) {
    response.headers.set(
      "Location",
      new URL("/completer-profil?next=" + encodeURIComponent(next), url.origin).toString()
    );
    return response;
  }

  return response;
}
