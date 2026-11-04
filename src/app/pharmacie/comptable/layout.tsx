import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { ComptableSidebar } from "@/components/pharmacie/ComptableSidebar";

export const dynamic = "force-dynamic";

export default async function ComptableLayout({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable");

  const [{ data: profile, error }, { data: activeRole, error: roleError }, { data: pharmacieId, error: pharmacyError }] = await Promise.all([
    sb.from("profiles").select("actif").eq("id", auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
    sb.rpc("naxa_active_role_pharmacy"),
  ]);
  if (error || roleError || pharmacyError || !profile || profile.actif !== true
    || activeRole !== "comptable" || typeof pharmacieId !== "string") {
    redirect("/pharmacie");
  }

  const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", {
    p_pharmacie: pharmacieId,
  });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  return <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-5 lg:grid-cols-[250px_minmax(0,1fr)]">
    <ComptableSidebar />
    <div className="min-w-0">{children}</div>
  </div>;
}
