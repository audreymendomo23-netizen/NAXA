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
  const tokenHash = url.searchParams.get("token_hash");
  const tokenType = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));

  if (!code && !(tokenHash && (tokenType === "signup" || tokenType === "email"))) {
    return NextResponse.redirect(new URL("/connexion?erreur=oauth", url.origin));
  }

  // Une réponse unique permet de conserver les cookies de session.
  const response = new NextResponse(null, { status: 302 });
  const supabase = supabaseServer(response);
  const { error: exchangeError } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: tokenType as "signup" | "email" });
  if (exchangeError) {
    response.headers.set("Location", new URL("/connexion?erreur=confirmation", url.origin).toString());
    return response;
  }

  const { data: auth, error: userError } = await supabase.auth.getUser();
  if (userError || !auth.user) {
    response.headers.set("Location", new URL("/connexion?erreur=oauth", url.origin).toString());
    return response;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,username,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    response.headers.set("Location", new URL("/connexion?erreur=profil", url.origin).toString());
    return response;
  }

  const appProviders = Array.isArray(auth.user.app_metadata?.providers) ? auth.user.app_metadata.providers : [];
  const identityProviders = Array.isArray(auth.user.identities) ? auth.user.identities.map((identity) => identity.provider) : [];
  // Un compte e-mail ensuite lié à Google peut garder provider=email dans app_metadata.
  // Détecter aussi les identités liées évite de traiter cette connexion comme un accès public.
  const isGoogleUser = auth.user.app_metadata?.provider === "google"
    || appProviders.includes("google")
    || identityProviders.includes("google");
  const incompleteGoogleClient = isGoogleUser && (
    !profile || !profile.role || (profile.role === "client" && (
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
  if (isGoogleUser) {
    // Google est exclusivement une méthode d'accès client : un rôle inattendu ne renvoie jamais vers "/".
    const clientDestination = next.startsWith("/client") ? next : "/client";
    destination = incompleteGoogleClient
      ? "/completer-profil?next=" + encodeURIComponent("/client")
      : clientDestination;
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
