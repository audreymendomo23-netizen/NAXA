import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Canonical server-side guard for NAXA administration pages and server actions.
 * A valid admin must have role=admin and actif=true; null is not treated as active.
 */
export async function requireAdminActive(returnTo = "/admin") {
  const sb = supabaseServer();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) {
    redirect("/connexion?retour=" + encodeURIComponent(returnTo));
  }

  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .select("role,actif")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin" || profile.actif !== true) {
    redirect("/");
  }

  return { sb, user: auth.user, profile };
}
