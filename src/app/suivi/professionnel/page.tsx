import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function SuiviProfessionnelPage(){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?retour=/suivi/professionnel");
  const {data:allowed}=await sb.rpc("suivi_is_verified_professional",{p_user_id:auth.user.id});
  if(allowed!==true) redirect("/suivi/professionnel/demande");
  redirect("/pharmacie/pharmacien/suivi-patients");
}
