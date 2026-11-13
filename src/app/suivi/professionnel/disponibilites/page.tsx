import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { SuiviProfessionalWorkspaceShell } from "@/components/suivi/SuiviProfessionalWorkspaceShell";
import { SuiviProfessionalAvailabilityEditor } from "@/components/suivi/SuiviProfessionalAvailabilityEditor";
import { SuiviProfessionalPartnerLocationEditor, type ProfessionalPartnerLocation } from "@/components/suivi/SuiviProfessionalPartnerLocationEditor";

export default async function SuiviProfessionalAvailabilityPage({searchParams}:{searchParams?:Promise<{position?:string;erreurPosition?:string}>}){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?next=%2Fsuivi%2Fprofessionnel%2Fdisponibilites");
  const [{data:enabled},{data:verified}]=await Promise.all([
    sb.rpc("suivi_is_enabled_user",{p_user_id:auth.user.id}),
    sb.rpc("suivi_is_verified_professional",{p_user_id:auth.user.id})
  ]);
  if(enabled!==true) redirect("/suivi");
  if(verified!==true) redirect("/suivi/professionnel/demande");
  const params=await searchParams;
  const {data:members,error:membersError}=await sb.from("partner_members")
    .select("partner_id,member_role,partners!inner(id,name,partner_type,status,city,neighborhood,latitude,longitude,provider_latitude,provider_longitude,provider_location_updated_at)")
    .eq("user_id",auth.user.id).in("member_role",["owner","manager","operator"]);
  const partnerLocations:ProfessionalPartnerLocation[]=(members??[])
    .filter((row:any)=>row.partners?.partner_type==="professionnel_domicile"&&row.partners?.status==="active")
    .map((row:any)=>({
      partner_id:row.partner_id,partner_name:row.partners.name,city:row.partners.city,neighborhood:row.partners.neighborhood,
      admin_latitude:row.partners.latitude==null?null:Number(row.partners.latitude),
      admin_longitude:row.partners.longitude==null?null:Number(row.partners.longitude),
      provider_latitude:row.partners.provider_latitude==null?null:Number(row.partners.provider_latitude),
      provider_longitude:row.partners.provider_longitude==null?null:Number(row.partners.provider_longitude),
      provider_location_updated_at:row.partners.provider_location_updated_at
    }));
  return <SuiviProfessionalWorkspaceShell>
    <header className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Espace professionnel de santé</p>
      <h2 className="mt-1 text-2xl font-black text-slate-900">Mes disponibilités</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Votre planning est réutilisé par l’annuaire d’assistance des dispositifs connectés et, lorsque votre compte est rattaché à un partenaire de soins à domicile, par l’univers Prestations.</p>
    </header>
    {params?.position==="updated"&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Votre position est enregistrée. Elle est désormais prioritaire dans les recherches clients.</p>}
    {params?.erreurPosition&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">La position n’a pas été enregistrée. Vérifiez votre affectation, votre agrément et les coordonnées GPS.</p>}
    {membersError&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Impossible de charger les partenaires rattachés à votre compte. La modification de position est temporairement indisponible.</p>}
    <SuiviProfessionalPartnerLocationEditor partners={partnerLocations}/>
    <SuiviProfessionalAvailabilityEditor userId={auth.user.id}/>
  </SuiviProfessionalWorkspaceShell>;
}
