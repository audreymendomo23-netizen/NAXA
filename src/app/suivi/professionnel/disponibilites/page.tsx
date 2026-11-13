import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function SuiviProfessionalAvailabilityPage(){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?next=%2Fsuivi%2Fprofessionnel%2Fdisponibilites");
  const {data:enabled}=await sb.rpc("suivi_is_enabled_user",{p_user_id:auth.user.id});
  if(enabled!==true)redirect("/suivi");
  redirect("/partenaire/prestations/convention?source=dispositifs-connectes");
}
