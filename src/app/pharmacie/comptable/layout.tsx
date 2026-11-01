import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { ComptableSidebar } from "@/components/pharmacie/ComptableSidebar";

export const dynamic = "force-dynamic";

export default async function ComptableLayout({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable");

  const { data: profile, error } = await sb.from("profiles")
    .select("actif,pharmacie_id").eq("id", auth.user.id).maybeSingle();
  if (error || !profile || profile.actif !== true || !profile.pharmacie_id) {
    redirect("/pharmacie");
  }

  const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", {
    p_pharmacie: profile.pharmacie_id,
  });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  return <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-5 lg:grid-cols-[250px_minmax(0,1fr)]">
    <ComptableSidebar />
    <div className="min-w-0">{children}</div>
  </div>;
}
