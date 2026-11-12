import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { SuiviProfessionalPatientsWorkspace } from "@/components/suivi/SuiviProfessionalPatientsWorkspace";

async function renderProfessionalWorkspace() {
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?next=%2Fsuivi%2Fprofessionnel%2Fpatients");
  const [{data:enabled},{data:verified}]=await Promise.all([
    sb.rpc("suivi_is_enabled_user",{p_user_id:auth.user.id}),
    sb.rpc("suivi_is_verified_professional",{p_user_id:auth.user.id})
  ]);
  if(enabled!==true) redirect("/suivi");
  if(verified!==true) redirect("/suivi/professionnel/demande");
  return <SuiviProfessionalPatientsWorkspace />;
}

export default async function SuiviProfessionnelPatientsPage(){
  return renderProfessionalWorkspace();
}
