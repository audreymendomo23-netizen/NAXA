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

const CANONICAL_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://naxa-naxa3.vercel.app"
).replace(/\/+$/, "");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));

  // Le cookie PKCE doit être créé et relu sur le même hôte.
  // Ramener les URL de déploiement Vercel vers l’alias stable évite
  // qu’un verifier créé sur un hôte preview soit échangé sur un autre domaine.
  if (url.origin !== CANONICAL_ORIGIN) {
    const canonicalStart = new URL("/api/auth/google", CANONICAL_ORIGIN);
    canonicalStart.searchParams.set("next", next);
    return NextResponse.redirect(canonicalStart, 307);
  }

  // Réponse neutre : les cookies PKCE et la redirection OAuth partent ensemble.
  const response = new NextResponse(null, { status: 302 });
  const supabase = supabaseServer(response);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: CANONICAL_ORIGIN + "/auth/callback?next=" + encodeURIComponent(next),
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/connexion?erreur=oauth", CANONICAL_ORIGIN));
  }

  // Le verifier PKCE est écrit dans les cookies par le client SSR sur cette réponse.
  response.headers.set("Location", data.url);
  return response;
}
