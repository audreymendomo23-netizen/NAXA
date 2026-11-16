"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
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

  const [{data:profile},{data:businessFunction},{data:activePharmacy}]=await Promise.all([
    sb.from("profiles").select("role,actif,pharmacie_id").eq("id",auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
    sb.rpc("naxa_active_role_pharmacy"),
  ]);
  const isPromoteur=profile?.role==="promoteur"&&profile.actif===true&&businessFunction==="promoteur";
  const isPharmacie=profile?.role==="pharmacie"&&profile.actif===true&&businessFunction==="pharmacie"&&Boolean(activePharmacy);
  if(!isPromoteur&&!isPharmacie)redirect("/pharmacie/promoteur");

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
    ||!["caisse","gestionnaire_stock","magasinier","responsable","comptable","livreur"].includes(fonction)
    ||(isPharmacie&&(fonction!=="livreur"||pharmacie!==String(activePharmacy)))
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

  const {data:cumulativeRequest,error:cumulativeError}=await sb.rpc("naxa_request_cumulative_activity",{
    p_target_profile_id:matches[0].id,
    p_direction:"SPD_VERS_PHARMACIE",
    p_destination_pharmacy_id:pharmacie,
    p_destination_partner_id:null,
    p_destination_role_code:fonction,
    p_reason:motif,
  });
  if(cumulativeError)redirect("/pharmacie/affectations?erreur=cumul");
  if(cumulativeRequest)redirect("/naxa/cumuls?ok=demande_envoyee");

  const {data:cumulativeRequest,error:cumulativeError}=await sb.rpc("naxa_request_cumulative_activity",{
    p_target_profile_id:matches[0].id,
    p_direction:"SPD_VERS_PHARMACIE",
    p_destination_pharmacy_id:pharmacie,
    p_destination_partner_id:null,
    p_destination_role_code:fonction,
    p_reason:motif,
  });
  if(cumulativeError)redirect("/pharmacie/affectations?erreur=cumul");
  if(cumulativeRequest)redirect("/naxa/cumuls?ok=demande_envoyee");

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


export async function proposerAccreditationPharmacien(formData:FormData){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/affectations");

  const {data:actor,error:actorError}=await sb.from("profiles")
    .select("role,actif").eq("id",auth.user.id).maybeSingle();
  if(actorError||actor?.role!=="promoteur"||actor.actif!==true){
    redirect("/pharmacie/affectations?erreur=accreditation_acteur");
  }

  const pharmacyId=value(formData,"pharmacie_id");
  const username=value(formData,"username").toLowerCase();
  const registrationNumber=value(formData,"registration_number");
  const issuingAuthority=value(formData,"issuing_authority");
  const specialty=value(formData,"specialty");
  const motif=value(formData,"motif");
  const validUntil=value(formData,"valid_until");
  const file=formData.get("justificatif");

  if(!uuid.test(pharmacyId)
    ||!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)
    ||registrationNumber.length<3||registrationNumber.length>100
    ||issuingAuthority.length<2||issuingAuthority.length>180
    ||specialty.length>120
    ||motif.length<5||motif.length>500
    ||(validUntil&&!/^\d{4}-\d{2}-\d{2}$/.test(validUntil))
    ||!(file instanceof File)||file.size===0||file.size>10*1024*1024
    ||!["application/pdf","image/jpeg","image/png"].includes(file.type)){
    redirect("/pharmacie/affectations?erreur=accreditation_validation");
  }

  const db=supabaseAdmin();
  const {data:matches,error:lookupError}=await db.from("profiles")
    .select("id,username,actif").ilike("username",username).limit(2);
  if(lookupError)redirect("/pharmacie/affectations?erreur=recherche");
  if(!matches||matches.length!==1||matches[0].actif!==true){
    redirect("/pharmacie/affectations?erreur=cible");
  }

  const extension=file.type==="application/pdf"?"pdf":file.type==="image/png"?"png":"jpg";
  const storagePath=[auth.user.id,matches[0].id,pharmacyId,randomUUID()+"."+extension].join("/");
  // Upload avec la session du Promoteur : la policy Storage vérifie son réseau,
  // la pharmacie, le compte cible et le type MIME avant tout stockage.
  const {error:uploadError}=await sb.storage.from("naxa-pharmacien-accreditations")
    .upload(storagePath,file,{contentType:file.type,upsert:false});
  if(uploadError)redirect("/pharmacie/affectations?erreur=accreditation_document");

  const {error:proposalError}=await sb.rpc("naxa_proposer_accreditation_pharmacien",{
    p_target:matches[0].id,
    p_pharmacie:pharmacyId,
    p_registration_number:registrationNumber,
    p_issuing_authority:issuingAuthority,
    p_specialty:specialty||null,
    p_credential_storage_path:storagePath,
    p_valid_until:validUntil||null,
    p_motif:motif,
  });
  if(proposalError){
    await db.storage.from("naxa-pharmacien-accreditations").remove([storagePath]);
    redirect("/pharmacie/affectations?erreur=accreditation_rpc");
  }
  revalidatePath("/pharmacie/affectations");
  redirect("/pharmacie/affectations?ok=accreditation_proposee");
}


export async function deciderAccreditationPharmacien(formData:FormData){
  const sb=supabaseServer();
  const {data:auth,error:authError}=await sb.auth.getUser();
  if(authError||!auth.user)redirect("/connexion?retour=/pharmacie/affectations");

  const accreditationId=value(formData,"accreditation_id");
  const decision=value(formData,"decision");
  const note=value(formData,"decision_note");
  if(!uuid.test(accreditationId)||!["approve","reject","revoke"].includes(decision)
    ||((decision==="reject"||decision==="revoke")&&note.length<5)
    ||note.length>1000){
    redirect("/pharmacie/affectations?erreur=accreditation_decision_validation");
  }

  const {error}=await sb.rpc("naxa_promoteur_decider_accreditation_pharmacien",{
    p_accreditation:accreditationId,
    p_decision:decision,
    p_note:note||null,
  });
  if(error)redirect("/pharmacie/affectations?erreur=accreditation_decision_refusee");
  revalidatePath("/pharmacie/affectations");
  revalidatePath("/pharmacie/pharmacien");
  revalidatePath("/pharmacien/validations");
  redirect("/pharmacie/affectations?ok="+(
    decision==="approve"?"accreditation_validee":decision==="reject"?"accreditation_refusee":"accreditation_retiree"
  ));
}
