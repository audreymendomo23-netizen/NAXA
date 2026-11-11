"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const value=(form:FormData,key:string,max=500)=>String(form.get(key)??"").trim().slice(0,max);

function localDate(raw:string):Date {
  return new Date(raw.length===16 ? raw + ":00+01:00" : raw);
}

async function partnerManagerContext(requestedPartnerId?:string) {
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/partenaire/affectations");
  const [{data:partnerId,error:partnerError},{data:role,error:roleError}]=await Promise.all([
    sb.rpc("naxa_active_role_partner"),
    sb.rpc("naxa_business_function"),
  ]);
  if(partnerError||roleError||typeof partnerId!=="string"
    ||(requestedPartnerId&&requestedPartnerId!==partnerId)) {
    redirect("/partenaire/catalogue?erreur=selection_espace");
  }
  if(role!=="promoteur"&&role!=="responsable")redirect("/partenaire/catalogue?erreur=autorisation");
  const {data:allowed,error:allowedError}=await sb.rpc("naxa_can_partner",{
    p_privilege:"VIEW_TEAM",p_partner_id:partnerId,
  });
  if(allowedError||allowed!==true)redirect("/partenaire/catalogue?erreur=autorisation");
  return {sb,userId:auth.user.id,partnerId,role};
}

export async function accorderAffectationParapharmacie(form:FormData) {
  const partnerId=value(form,"partner_id",36);
  const {sb,partnerId:activePartnerId,role}=await partnerManagerContext(partnerId);
  const username=value(form,"username",30).toLowerCase();
  const functionCode=value(form,"fonction",40);
  const startRaw=value(form,"commence_at",40);
  const expiryRaw=value(form,"expire_at",40);
  const reason=value(form,"motif",500);
  const start=startRaw?localDate(startRaw):new Date();
  const expiry=expiryRaw?localDate(expiryRaw):null;
  const allowedRoles=["caisse","gestionnaire_stock","magasinier","pharmacien","responsable","comptable"];
  if(!uuid.test(activePartnerId)||!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)
    ||!allowedRoles.includes(functionCode)
    ||(role==="responsable"&&functionCode!=="caisse")
    ||!Number.isFinite(start.getTime())
    ||(expiry&&(!Number.isFinite(expiry.getTime())||expiry<=start))
    ||reason.length<5)redirect("/partenaire/affectations?erreur=validation");

  const admin=supabaseAdmin();
  const {data:matches,error:lookupError}=await admin.from("profiles")
    .select("id,username,actif,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
    .ilike("username",username).limit(2);
  if(lookupError)redirect("/partenaire/affectations?erreur=recherche");
  if(!matches||matches.length!==1||matches[0].actif!==true
    ||!matches[0].first_name||!matches[0].last_name||!matches[0].phone
    ||!matches[0].date_of_birth||matches[0].age_verified!==true||!matches[0].consent_accepted_at) {
    redirect("/partenaire/affectations?erreur=cible");
  }
  const {data:authData,error:authError}=await admin.auth.admin.getUserById(matches[0].id);
  if(authError||!authData.user
    ||!isFinalizedNaxaProfile({id:matches[0].id,username:matches[0].username??""},authData.user)) {
    redirect("/partenaire/affectations?erreur=cible");
  }

  const {error}=await sb.rpc("naxa_grant_partner_professional_assignment",{
    p_target:matches[0].id,
    p_partner_id:activePartnerId,
    p_fonction:functionCode,
    p_commence_at:start.toISOString(),
    p_expire_at:expiry?.toISOString()??null,
    p_motif:reason,
  });
  if(error)redirect("/partenaire/affectations?erreur=autorisation");
  revalidatePath("/partenaire/affectations");
  revalidatePath("/partenaire/catalogue");
  redirect("/partenaire/affectations?ok=accordee");
}

export async function revoquerAffectationParapharmacie(form:FormData) {
  const partnerId=value(form,"partner_id",36);
  const {sb}=await partnerManagerContext(partnerId);
  const assignmentId=value(form,"affectation_id",36);
  const reason=value(form,"motif_revocation",500);
  if(!uuid.test(assignmentId)||reason.length<5)redirect("/partenaire/affectations?erreur=revocation");
  const {error}=await sb.rpc("naxa_revoke_partner_professional_assignment",{
    p_assignment:assignmentId,p_motif:reason,
  });
  if(error)redirect("/partenaire/affectations?erreur=revocation");
  revalidatePath("/partenaire/affectations");
  revalidatePath("/partenaire/catalogue");
  redirect("/partenaire/affectations?ok=revoquee");
}

export async function attribuerPrivilegeParapharmacie(form:FormData) {
  const partnerId=value(form,"partner_id",36);
  const {sb,partnerId:activePartnerId}=await partnerManagerContext(partnerId);
  const targetId=value(form,"profile_id",36);
  const privilege=value(form,"privilege_code",80);
  if(!uuid.test(targetId)||!privilege)redirect("/partenaire/affectations?erreur=privilege");
  const {error}=await sb.rpc("naxa_grant_partner_privilege",{
    p_target:targetId,p_partner_id:activePartnerId,p_privilege:privilege,
  });
  if(error)redirect("/partenaire/affectations?erreur=privilege");
  revalidatePath("/partenaire/affectations");
  redirect("/partenaire/affectations?ok=privilege");
}

export async function retirerPrivilegeParapharmacie(form:FormData) {
  const partnerId=value(form,"partner_id",36);
  const {sb,partnerId:activePartnerId}=await partnerManagerContext(partnerId);
  const targetId=value(form,"profile_id",36);
  const privilege=value(form,"privilege_code",80);
  if(!uuid.test(targetId)||!privilege)redirect("/partenaire/affectations?erreur=privilege");
  const {error}=await sb.rpc("naxa_revoke_partner_privilege",{
    p_target:targetId,p_partner_id:activePartnerId,p_privilege:privilege,
  });
  if(error)redirect("/partenaire/affectations?erreur=privilege");
  revalidatePath("/partenaire/affectations");
  redirect("/partenaire/affectations?ok=privilege_retire");
}
