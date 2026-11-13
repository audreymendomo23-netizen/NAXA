import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { SuiviProfessionalWorkspaceShell } from "@/components/suivi/SuiviProfessionalWorkspaceShell";
import { SuiviProfessionalAvailabilityEditor } from "@/components/suivi/SuiviProfessionalAvailabilityEditor";

export default async function SuiviProfessionalAvailabilityPage(){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?next=%2Fsuivi%2Fprofessionnel%2Fdisponibilites");
  const [{data:enabled},{data:verified}]=await Promise.all([
    sb.rpc("suivi_is_enabled_user",{p_user_id:auth.user.id}),
    sb.rpc("suivi_is_verified_professional",{p_user_id:auth.user.id})
  ]);
  if(enabled!==true) redirect("/suivi");
  if(verified!==true) redirect("/suivi/professionnel/demande");
  return <SuiviProfessionalWorkspaceShell>
    <header className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Espace professionnel de santé</p>
      <h2 className="mt-1 text-2xl font-black text-slate-900">Mes disponibilités</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Votre planning est réutilisé par l’annuaire d’assistance des dispositifs connectés et, lorsque votre compte est rattaché à un partenaire de soins à domicile, par l’univers Prestations.</p>
    </header>
    <SuiviProfessionalAvailabilityEditor userId={auth.user.id}/>
  </SuiviProfessionalWorkspaceShell>;
}
