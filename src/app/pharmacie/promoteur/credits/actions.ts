"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const valid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

async function decide(formData:FormData,approve:boolean){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/promoteur/credits");

  const id=String(formData.get("demande_id")??"");
  if(!valid(id))redirect("/pharmacie/promoteur/credits?erreur=reference");

  const {data:profile}=await sb.from("profiles")
    .select("role,fonction_interne,actif,niveau_interne")
    .eq("id",auth.user.id).maybeSingle();

  if(!profile||profile.actif!==true)redirect("/");
  const isPromoteur=profile.role==="promoteur"&&profile.niveau_interne===1;
  const isResponsable=profile.role==="pharmacie"
    &&profile.fonction_interne==="responsable"
    &&profile.niveau_interne===2;
  if(!isPromoteur&&!isResponsable)redirect("/");

  const base=isResponsable?"/pharmacie/responsable/credits":"/pharmacie/promoteur/credits";
  const {error}=await sb.rpc("client_credit_demande_decider",{
    p_demande:id,
    p_approuver:approve,
  });
  if(error)redirect(base+"?erreur=decision");

  revalidatePath("/pharmacie/promoteur/credits");
  revalidatePath("/pharmacie/responsable/credits");
  revalidatePath("/pharmacie/gestionnaire-stock/reservations");
  revalidatePath("/achats/credit/suivi");
  redirect(base+"?ok="+(approve?"approuvee":"rejetee"));
}

export async function approuverDemandeCreditMarketplace(formData:FormData){
  return decide(formData,true);
}

export async function refuserDemandeCreditMarketplace(formData:FormData){
  return decide(formData,false);
}


export async function configurerCreditClient(formData:FormData){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/promoteur/credits");
  const {data:profile}=await sb.from("profiles").select("role,actif,niveau_interne").eq("id",auth.user.id).maybeSingle();
  if(!profile||profile.role!=="promoteur"||profile.actif!==true||profile.niveau_interne!==1)redirect("/");
  const clientId=String(formData.get("client_id")??"");
  const pharmacieId=String(formData.get("pharmacie_id")??"");
  const plafond=Number(formData.get("plafond")??NaN);
  if(!valid(clientId)||!valid(pharmacieId)||!Number.isSafeInteger(plafond)||plafond<0||plafond>2147483647){
    redirect("/pharmacie/promoteur/credits?erreur=configuration");
  }
  const {error}=await sb.rpc("client_credit_configurer",{
    p_client:clientId,p_pharmacie:pharmacieId,p_plafond:plafond,
  });
  if(error)redirect("/pharmacie/promoteur/credits?erreur=configuration");
  revalidatePath("/pharmacie/promoteur/credits");
  revalidatePath("/pharmacie/caisse");
  redirect("/pharmacie/promoteur/credits?ok=configuration");
}

export async function configurerPlafondResponsable(formData:FormData){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/promoteur/credits");
  const {data:profile}=await sb.from("profiles").select("role,actif,niveau_interne").eq("id",auth.user.id).maybeSingle();
  if(!profile||profile.role!=="promoteur"||profile.actif!==true||profile.niveau_interne!==1)redirect("/");
  const responsable=String(formData.get("responsable_id")??"");
  const pharmacie=String(formData.get("pharmacie_id")??"");
  const plafond=Number(formData.get("plafond_fcfa")??NaN);
  if(!valid(responsable)||!valid(pharmacie)||!Number.isSafeInteger(plafond)||plafond<0||plafond>2147483647){
    redirect("/pharmacie/promoteur/credits?erreur=plafond");
  }
  const {error}=await sb.rpc("naxa_responsable_credit_limit_configurer",{
    p_responsable:responsable,p_pharmacie:pharmacie,p_plafond_fcfa:plafond,
  });
  if(error)redirect("/pharmacie/promoteur/credits?erreur=plafond");
  revalidatePath("/pharmacie/promoteur/credits");
  revalidatePath("/pharmacie/responsable/credits");
  redirect("/pharmacie/promoteur/credits?ok=plafond_responsable");
}
