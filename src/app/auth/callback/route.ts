import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { MAX_CONCURRENT_SESSIONS } from "@/lib/auth/session-limit";

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
      return response;
    }
    if (error.message?.includes("NAXA_SESSION_LIMIT_REACHED")) {
      return NextResponse.redirect(
        new URL(`/connexion?erreur=limite-appareils&max=${MAX_CONCURRENT_SESSIONS}`, url.origin)
      );
    }

  }

  return NextResponse.redirect(new URL("/connexion?erreur=oauth", url.origin));
}
