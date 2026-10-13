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

export async function middleware(req: NextRequest) {
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
  if (!data.user) return res;

  const path = req.nextUrl.pathname;
  const isOnboardingExempt = onboardingExempt.some(
    (allowed) => path === allowed || path.startsWith(allowed + "/")
  );

  if (!isOnboardingExempt && !path.startsWith("/api/")) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role,username,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
      .eq("id", data.user.id)
      .maybeSingle();

    // Fail closed: aucun accès applicatif tant que l'état du profil n'est pas lisible/complet.
    const incomplete = !!error || !profile
      || (profile.role === "client" && (
        !profile.username || !profile.first_name || !profile.last_name || !profile.phone
        || !profile.date_of_birth || !profile.age_verified || !profile.consent_accepted_at
      ));

    if (incomplete) {
      const target = req.nextUrl.clone();
      target.pathname = "/completer-profil";
      target.search = "";
      target.searchParams.set("next", path + req.nextUrl.search);
      return NextResponse.redirect(target);
    }
  }

  const protectedPath = ["/pharmacie", "/admin", "/reservation", "/go", "/produit", "/panier"]
    .some((prefix) => path.startsWith(prefix));
  if (!protectedPath) return res;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,age_verified")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.role === "client" && !profile.age_verified) {
    const target = req.nextUrl.clone();
    target.pathname = "/verification-age";
    target.searchParams.set("retour", path + req.nextUrl.search);
    return NextResponse.redirect(target);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-.*|manifest.webmanifest|sw.js|workbox-.*|api/health).*)"],
};
