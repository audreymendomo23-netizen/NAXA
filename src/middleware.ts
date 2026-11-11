import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const onboardingExempt = [
  "/completer-profil",
  "/auth/callback",
  "/connexion",
  "/creation-compte",
  "/conditions-utilisation",
  "/politique-confidentialite",
  "/politique-securite",
];

const protectedPrefixes = [
  "/client",
  "/pharmacie",
  "/admin",
  "/reservation",
  "/go",
  "/panier",
  "/verification-age",
  "/parapharmacie",
  "/bebe-maman",
  "/examens",
  "/prestations",
  "/suivi",
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Ne pas laisser le middleware rafraîchir ou réécrire les cookies pendant
  // les échanges OAuth/OTP : ces routes gèrent elles-mêmes leurs cookies.
  // En particulier, le verifier PKCE doit rester celui émis au démarrage OAuth.
  const authFlow =
    path === "/auth/callback" ||
    path === "/api/auth/google" ||
    path === "/api/auth/signup-otp" ||
    path.startsWith("/api/auth/signup-otp/");
  if (authFlow) return NextResponse.next({ request: req });

  // La déclaration d’âge ne doit pas protéger uniquement l’écran d’accueil :
  // les accès directs aux pages applicatives exigent aussi une déclaration adulte.
  const ageExemptPath =
    path === "/" ||
    path === "/conditions-utilisation" ||
    path.startsWith("/conditions-utilisation/") ||
    path === "/politique-confidentialite" ||
    path.startsWith("/politique-confidentialite/") ||
    path === "/politique-securite" ||
    path.startsWith("/politique-securite/") ||
    path.startsWith("/api/");
  const ageStatus = req.cookies.get("naxa-age-status-v2")?.value;
  if (!ageExemptPath && ageStatus !== "adult") {
    const target = req.nextUrl.clone();
    target.pathname = "/";
    target.search = "";
    target.searchParams.set("retourAge", path + req.nextUrl.search);
    return NextResponse.redirect(target);
  }

  const isOnboardingExempt = onboardingExempt.some(
    (allowed) => path === allowed || path.startsWith(allowed + "/")
  );
  const protectedPath = protectedPrefixes.some(
    (prefix) => path === prefix || path.startsWith(prefix + "/")
  );

  // Le verrouillage Admin doit aussi protéger les URL saisies directement.
  // La policy RLS publique de public.universes ne retourne que les espaces actifs.
  const universParcours = [
    { prefix: "/parapharmacie", slug: "parapharmacie" },
    { prefix: "/bebe-maman", slug: "bebe-maman" },
    { prefix: "/examens", slug: "examens" },
    { prefix: "/centre-examens", slug: "examens" },
    { prefix: "/prestations", slug: "prestations" },
    { prefix: "/partenaire/prestations", slug: "prestations" },
    { prefix: "/suivi", slug: "suivi" },
  ];
  let universVerrouillable = universParcours.find(
    (item) => path === item.prefix || path.startsWith(item.prefix + "/")
  );
  if (path === "/partenaire/catalogue" || path.startsWith("/partenaire/catalogue/")) {
    const ecosystemeCatalogue =
      req.nextUrl.searchParams.get("ecosysteme")
      ?? req.cookies.get("naxa-ecosysteme")?.value;
    if (ecosystemeCatalogue === "parapharmacie") {
      universVerrouillable = { prefix: "/partenaire/catalogue", slug: "parapharmacie" };
    } else if (ecosystemeCatalogue === "bebe-maman") {
      universVerrouillable = { prefix: "/partenaire/catalogue", slug: "bebe-maman" };
    }
  }
  if (universVerrouillable) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let enabled = false;
    try {
      if (!supabaseUrl || !anonKey) throw new Error("public_supabase_not_configured");
      const statusUrl = new URL("/rest/v1/universes", supabaseUrl);
      statusUrl.searchParams.set("select", "slug");
      statusUrl.searchParams.set("slug", `eq.${universVerrouillable.slug}`);
      const statusResponse = await fetch(statusUrl.toString(), {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (!statusResponse.ok) throw new Error("universe_status_unavailable");
      const rows = await statusResponse.json();
      enabled = Array.isArray(rows) && rows.some(
        (row) => row && row.slug === universVerrouillable.slug
      );
    } catch {
      // Fail closed : un état Admin inconnu ne doit jamais ouvrir un univers.
      enabled = false;
    }

    if (!enabled) {
      const target = req.nextUrl.clone();
      target.pathname = "/";
      target.search = "";
      target.searchParams.set("choisirEcosysteme", "1");
      target.searchParams.set("universVerrouille", universVerrouillable.slug);
      return NextResponse.redirect(target);
    }
  }

  // Les pages publiques et les écrans d'authentification ne doivent pas attendre
  // Supabase : une panne réseau ne doit jamais bloquer l'affichage du site.
  if (isOnboardingExempt || path.startsWith("/api/") || !protectedPath) {
    return NextResponse.next({ request: req });
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const target = req.nextUrl.clone();
    target.pathname = "/connexion";
    target.search = "";
    target.searchParams.set("espace", path.startsWith("/pharmacie") ? "pharmacie" : "client");
    target.searchParams.set("retour", path + req.nextUrl.search);
    return NextResponse.redirect(target);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,username,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
    .eq("id", data.user.id)
    .maybeSingle();

  if (error) {
    const target = req.nextUrl.clone();
    target.pathname = "/connexion";
    target.search = "?erreur=profil";
    return NextResponse.redirect(target);
  }

  const isGoogleUser = data.user.app_metadata?.provider === "google";
  if (!profile) {
    if (isGoogleUser) {
      const target = req.nextUrl.clone();
      target.pathname = "/completer-profil";
      target.search = "";
      target.searchParams.set("next", path + req.nextUrl.search);
      return NextResponse.redirect(target);
    }
    const target = req.nextUrl.clone();
    target.pathname = "/connexion";
    target.search = "?erreur=profil";
    return NextResponse.redirect(target);
  }

  const incompleteClient = profile.role === "client" && (
    !profile.username || !profile.first_name || !profile.last_name || !profile.phone
    || !profile.date_of_birth || !profile.age_verified || !profile.consent_accepted_at
  );
  if (incompleteClient && isGoogleUser) {
    const target = req.nextUrl.clone();
    target.pathname = "/completer-profil";
    target.search = "";
    target.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(target);
  }

  if (profile.role === "client" && !profile.age_verified && path !== "/verification-age") {
    const target = req.nextUrl.clone();
    target.pathname = "/verification-age";
    target.search = "";
    target.searchParams.set("retour", path + req.nextUrl.search);
    return NextResponse.redirect(target);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-.*|manifest.webmanifest|sw.js|workbox-.*).*)"],
};
