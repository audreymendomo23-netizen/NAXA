"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(fd:FormData,key:string){
  return String(fd.get(key)??"").trim();
}

function doualaDate(value:string):Date{
  return new Date(`${value}:00+01:00`);
}

export async function accorderAffectationProfessionnelle(formData:FormData){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/affectations");

  const {data:profile}=await sb.from("profiles").select("role,actif")
    .eq("id",auth.user.id).maybeSingle();
  if(profile?.role!=="promoteur"||profile.actif!==true)redirect("/pharmacie/promoteur");

  const pharmacie=value(formData,"pharmacie_id");
  const username=value(formData,"username").toLowerCase();
  const fonction=value(formData,"fonction");
  const nature=value(formData,"nature_affectation");
  const debut=value(formData,"commence_at");
  const fin=value(formData,"expire_at");
  const motif=value(formData,"motif");
  const debutDate=debut?doualaDate(debut):null;
  const finDate=nature==="urgence"&&fin?doualaDate(fin):null;

  if(!uuid.test(pharmacie)
    ||!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)
    ||!["caisse","gestionnaire_stock","magasinier","pharmacien","responsable","comptable","livreur"].includes(fonction)
    ||!["ordinaire","urgence"].includes(nature)
    ||!debutDate||!Number.isFinite(debutDate.getTime())
    ||(nature==="urgence"&&(!finDate||!Number.isFinite(finDate.getTime())||finDate<=debutDate))
    ||motif.length<5||motif.length>500){
    redirect("/pharmacie/affectations?erreur=validation");
  }

  const db=supabaseAdmin();
  const {data:matches,error:lookupError}=await db.from("profiles")
    .select("id,username,actif").ilike("username",username).limit(2);
  if(lookupError)redirect("/pharmacie/affectations?erreur=recherche");
  if(!matches||matches.length!==1||matches[0].actif!==true){
    redirect("/pharmacie/affectations?erreur=cible");
  }

  const {error}=fonction==="livreur"
    ?await sb.rpc("naxa_grant_livreur_assignment",{
      p_target:matches[0].id,p_pharmacie:pharmacie,
      p_commence_at:debutDate.toISOString(),p_expire_at:finDate?.toISOString()??null,p_motif:motif,
    })
    :await sb.rpc("naxa_grant_professional_assignment",{
      p_target:matches[0].id,p_pharmacie:pharmacie,p_fonction:fonction,
      p_commence_at:debutDate.toISOString(),p_expire_at:finDate?.toISOString()??null,p_motif:motif,
    });
  if(error)redirect("/pharmacie/affectations?erreur=autorisation");
  revalidatePath("/pharmacie/affectations");
  revalidatePath("/pharmacie/gestionnaire-stock/reservations");
  redirect("/pharmacie/affectations?ok=accordee");
}

export async function revoquerAffectationProfessionnelle(formData:FormData){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/affectations");
  const id=value(formData,"affectation_id");
  const motif=value(formData,"motif_revocation");
  if(!uuid.test(id)||motif.length<5||motif.length>500){
    redirect("/pharmacie/affectations?erreur=revocation");
  }
  const {error}=await sb.rpc("naxa_revoke_professional_assignment",{
    p_assignment:id,
    p_motif:motif,
  });
  if(error)redirect("/pharmacie/affectations?erreur=revocation");
  revalidatePath("/pharmacie/affectations");
  revalidatePath("/pharmacie/gestionnaire-stock/reservations");
  revalidatePath("/pharmacie/responsable/credits");
  redirect("/pharmacie/affectations?ok=revoquee");
}



async function verifierResponsableAffecte(
  sb:ReturnType<typeof supabaseServer>,
  actorId:string,
  targetId:string,
  pharmacyId:string,
){
  if(!uuid.test(targetId)||!uuid.test(pharmacyId)){
    redirect("/pharmacie/affectations?erreur=droit_credit");
  }

  const [{data:profile,error:profileError},{data:network,error:networkError},{data:assignment,error:assignmentError},{data:pharmacy,error:pharmacyError}] = await Promise.all([
    sb.from("profiles").select("id,role,fonction_interne,niveau_interne,parent_profile_id,actif")
      .eq("id",targetId).maybeSingle(),
    sb.from("promoteur_pharmacies").select("pharmacie_id")
      .eq("promoteur_id",actorId).eq("pharmacie_id",pharmacyId).eq("actif",true).maybeSingle(),
    sb.from("naxa_professional_assignments").select("id,commence_at,expire_at")
      .eq("profile_id",targetId).eq("pharmacie_id",pharmacyId)
      .eq("fonction","responsable").eq("statut","active"),
    sb.from("pharmacies").select("id,actif").eq("id",pharmacyId).maybeSingle(),
  ]);

  if(profileError||networkError||assignmentError||pharmacyError
    ||!profile||profile.actif!==true||profile.role!=="pharmacie"
    ||profile.fonction_interne!=="responsable"||profile.niveau_interne!==2
    ||profile.parent_profile_id!==actorId||!network
    ||!(assignment??[]).some(a=>new Date(a.commence_at).getTime()<=Date.now()
      &&(a.expire_at===null||new Date(a.expire_at).getTime()>Date.now()))
    ||!pharmacy||pharmacy.actif!==true){
    redirect("/pharmacie/affectations?erreur=droit_credit");
  }
}

async function gererDroitCreditMarketplace(formData:FormData,grant:boolean){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/affectations");

  const {data:actor}=await sb.from("profiles")
    .select("role,actif,niveau_interne").eq("id",auth.user.id).maybeSingle();
  if(!actor||actor.role!=="promoteur"||actor.actif!==true||actor.niveau_interne!==1){
    redirect("/pharmacie/promoteur");
  }

  const targetId=value(formData,"responsable_id");
  const pharmacyId=value(formData,"pharmacie_id");
  await verifierResponsableAffecte(sb,auth.user.id,targetId,pharmacyId);

  const {error}=grant
    ?await sb.rpc("naxa_grant_privilege",{
      p_target:targetId,
      p_privilege:"APPROVE_MARKETPLACE_CREDIT",
      p_pharmacie:pharmacyId,
      p_scope:"PHARMACIE",
    })
    :await sb.rpc("naxa_revoke_privilege",{
      p_target:targetId,
      p_privilege:"APPROVE_MARKETPLACE_CREDIT",
      p_pharmacie:pharmacyId,
      p_scope:"PHARMACIE",
    });

  if(error)redirect("/pharmacie/affectations?erreur=droit_credit");

  revalidatePath("/pharmacie/affectations");
  revalidatePath("/pharmacie/responsable/credits");
  redirect("/pharmacie/affectations?ok="+(grant?"droit_credit":"droit_credit_retire"));
}

export async function attribuerDroitCreditMarketplace(formData:FormData){
  return gererDroitCreditMarketplace(formData,true);
}

export async function retirerDroitCreditMarketplace(formData:FormData){
  return gererDroitCreditMarketplace(formData,false);
}
