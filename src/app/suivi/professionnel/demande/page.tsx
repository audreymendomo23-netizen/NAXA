import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { SuiviProfessionalApplication } from "@/components/suivi/SuiviProfessionalApplication";

export default async function SuiviProfessionalApplicationPage(){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?next=%2Fsuivi%2Fprofessionnel%2Fdemande");
  const {data:account,error}=await sb.from("profiles").select("actif").eq("id",auth.user.id).maybeSingle();
  if(error||account?.actif!==true) redirect("/");
  const {data:verified}=await sb.rpc("suivi_is_verified_professional",{p_user_id:auth.user.id});
  if(verified===true)redirect("/suivi/professionnel/patients");
  return <SuiviProfessionalApplication/>;
}
