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
  const next = safeNext(url.searchParams.get("next"));
  // Réponse neutre : ne pas initialiser une redirection vers l’accueil avant OAuth.
  // Les cookies PKCE sont ajoutés à cette même réponse avant la redirection Google.
  const response = new NextResponse(null, { status: 302 });
  const supabase = supabaseServer(response);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: url.origin + "/auth/callback?next=" + encodeURIComponent(next),
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/connexion?erreur=oauth", url.origin));
  }

  // Le verifier PKCE est écrit dans les cookies par le client SSR sur cette réponse.
  response.headers.set("Location", data.url);
  return response;
}
