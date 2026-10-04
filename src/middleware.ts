import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (
          list: { name: string; value: string; options: CookieOptions }[]
        ) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const prot = ["/pharmacie", "/admin", "/reservation", "/go", "/produit", "/panier"].some((p) =>
    req.nextUrl.pathname.startsWith(p)
  );

  if (prot && !data.user) {
    const u = req.nextUrl.clone();
    u.pathname = "/connexion";
    u.searchParams.set("retour", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(u);
  }

  if (prot && data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("age_verified")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.age_verified) {
      const u = req.nextUrl.clone();
      u.pathname = "/verification-age";
      u.searchParams.set("retour", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(u);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-.*|manifest.webmanifest|sw.js|workbox-.*).*)",
  ],
};