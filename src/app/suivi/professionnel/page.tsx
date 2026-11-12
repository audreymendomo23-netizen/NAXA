import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function SuiviProfessionnelPage(){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?retour=/suivi/professionnel");
  const [{data:enabled},{data:verified}]=await Promise.all([
    sb.rpc("suivi_is_enabled_user",{p_user_id:auth.user.id}),
    sb.rpc("suivi_is_verified_professional",{p_user_id:auth.user.id})
  ]);
  if(enabled!==true) redirect("/suivi");
  if(verified!==true) redirect("/suivi/professionnel/demande");
  redirect("/suivi/professionnel/patients");
}
