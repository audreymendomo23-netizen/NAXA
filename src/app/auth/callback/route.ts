import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/")) return "/";
  try {
    const target = new URL(value, "https://naxa.invalid");
    return target.origin === "https://naxa.invalid"
      ? target.pathname + target.search + target.hash
      : "/";
  } catch {
    return "/";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/connexion?erreur=oauth", url.origin));
  }

  // Conserver une réponse unique pour renvoyer les cookies de session PKCE.
  const response = new NextResponse(null, { status: 302 });
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
    return NextResponse.redirect(new URL("/connexion?erreur=profil", url.origin));
  }

  const isGoogleUser = auth.user.app_metadata?.provider === "google";
  const incompleteGoogleClient = isGoogleUser && (
    !profile || (profile.role === "client" && (
      !profile.username
      || !profile.first_name
      || !profile.last_name
      || !profile.phone
      || !profile.date_of_birth
      || !profile.age_verified
      || !profile.consent_accepted_at
    ))
  );

  let destination = next;
  if (incompleteGoogleClient) {
    destination = "/completer-profil?next=" + encodeURIComponent(
      next === "/connexion?redirectionRole=1" ? "/" : next
    );
  } else if (next === "/" || next === "/connexion?redirectionRole=1") {
    const espacesParRole: Record<string, string> = {
      client: "/client",
      pharmacie: "/pharmacie",
      promoteur: "/pharmacie",
      caisse: "/pharmacie",
      admin: "/admin",
    };
    destination = profile?.role && espacesParRole[profile.role]
      ? espacesParRole[profile.role]
      : "/";
  }

  response.headers.set("Location", new URL(destination, url.origin).toString());
  return response;
}
