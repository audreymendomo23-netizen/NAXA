import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/** Garde canonique de l'administration : le poste Admin doit être celui sélectionné. */
export async function requireAdminActive(returnTo = "/admin") {
  const sb = supabaseServer();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) {
    redirect("/connexion?retour=" + encodeURIComponent(returnTo));
  }

  const [{ data: profile, error: profileError }, { data: activeRole, error: activeRoleError }] = await Promise.all([
    sb.from("profiles").select("role,actif").eq("id", auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
  ]);

  if (profileError || activeRoleError || profile?.role !== "admin"
    || profile.actif !== true || activeRole !== "admin") {
    redirect("/");
  }

  return { sb, user: auth.user, profile };
}
