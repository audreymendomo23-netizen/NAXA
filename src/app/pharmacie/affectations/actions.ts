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
    ||!["caisse","gestionnaire_stock","magasinier","pharmacien","responsable","comptable"].includes(fonction)
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

  const {error}=await sb.rpc("naxa_grant_professional_assignment",{
    p_target:matches[0].id,
    p_pharmacie:pharmacie,
    p_fonction:fonction,
    p_commence_at:debutDate.toISOString(),
    p_expire_at:finDate?.toISOString()??null,
    p_motif:motif,
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
