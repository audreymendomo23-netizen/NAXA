import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { hasAvailableSessionSlot, MAX_CONCURRENT_SESSIONS } from "@/lib/auth/session-limit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let next = url.searchParams.get("next") ?? "/";

  if (!next.startsWith("/") || next.startsWith("//")) next = "/";

  if (code) {
    const response = NextResponse.redirect(new URL(next, url.origin));
    const supabase = supabaseServer(response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (userId && !(await hasAvailableSessionSlot(userId))) {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.redirect(
          new URL(
            `/connexion?erreur=limite-appareils&max=${MAX_CONCURRENT_SESSIONS}`,
            url.origin
          )
        );
      }

      return response;
    }
  }

  return NextResponse.redirect(new URL("/connexion?erreur=oauth", url.origin));
}
