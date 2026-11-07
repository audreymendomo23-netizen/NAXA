import {redirect} from "next/navigation";
import {supabaseServer} from "@/lib/supabase/server";
import {LivreurProfileClient} from "@/components/pharmacie/LivreurProfileClient";

export const dynamic="force-dynamic";

type AssignmentRow={
  id:string;pharmacie_id:string;statut:string;nature_affectation:string;
  motif:string|null;commence_at:string;expire_at:string|null;revoque_at:string|null;
  pharmacies:{nom:string}|{nom:string}[]|null;
};

export default async function LivreurProfilePage(){
  const sb=supabaseServer();
  const {data:auth,error:authError}=await sb.auth.getUser();
  if(authError||!auth.user)redirect("/connexion?retour=/pharmacie/livreur/profil");

  const [{data:profile,error:profileError},{data:role,error:roleError},{data:pharmacyId,error:pharmacyError}]=await Promise.all([
    sb.from("profiles").select("id,first_name,last_name,username,phone,age_verified,actif,created_at").eq("id",auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
    sb.rpc("naxa_active_role_pharmacy"),
  ]);
  if(profileError||roleError||pharmacyError||!profile||profile.actif!==true||role!=="livreur")redirect("/");

  const [{data:pharmacy},{data:rows,error:assignmentsError}]=await Promise.all([
    typeof pharmacyId==="string"?sb.from("pharmacies").select("nom").eq("id",pharmacyId).maybeSingle():Promise.resolve({data:null}),
    sb.from("naxa_professional_assignments")
      .select("id,pharmacie_id,statut,nature_affectation,motif,commence_at,expire_at,revoque_at,pharmacies(nom)")
      .eq("profile_id",auth.user.id).eq("role_code","livreur").order("commence_at",{ascending:false}),
  ]);
  const assignments=((rows??[]) as unknown as AssignmentRow[]).map(item=>{
    const relation=item.pharmacies;
    return {
      id:item.id,pharmacie_id:item.pharmacie_id,
      pharmacy_name:Array.isArray(relation)?relation[0]?.nom??null:relation?.nom??null,
      statut:item.statut,nature_affectation:item.nature_affectation,motif:item.motif,
      commence_at:item.commence_at,expire_at:item.expire_at,revoque_at:item.revoque_at,
    };
  });

  return <LivreurProfileClient
    profile={{id:profile.id,first_name:profile.first_name,last_name:profile.last_name,username:profile.username,phone:profile.phone,age_verified:profile.age_verified===true,actif:profile.actif===true,created_at:profile.created_at}}
    email={auth.user.email??""}
    activePharmacyName={pharmacy?.nom??null}
    assignments={assignments}
    assignmentsError={Boolean(assignmentsError)}
  />;
}
