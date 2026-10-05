"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

async function exigerPromoteur() {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/connexion?retour=/pharmacie");
  const { data: p } = await sb.from("profiles").select("id,role,pharmacie_id,actif").eq("id", u.user.id).single();
  if (p?.role !== "promoteur" || !p.pharmacie_id || !p.actif) redirect("/");
  return { userId: u.user.id, pharmacieId: p.pharmacie_id };
}
const value=(fd:FormData,key:string)=>String(fd.get(key)??"").trim();

export async function creerCaisse(formData:FormData){
  const {userId,pharmacieId}=await exigerPromoteur();
  const username=value(formData,"username").toLowerCase();
  const email=value(formData,"email").toLowerCase();
  const password=value(formData,"motdepasse");
  const firstName=value(formData,"first_name");
  const lastName=value(formData,"last_name");
  const phone=value(formData,"phone");
  const country=value(formData,"phone_country").toUpperCase();
  const dob=value(formData,"date_of_birth");
  if(!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)||!email||password.length<8||firstName.length<2||lastName.length<2||!phone||!dob)redirect("/pharmacie?erreur=caisse");
  const db=supabaseAdmin();
  const {data:created,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username,first_name:firstName,last_name:lastName,phone,phone_country:country,date_of_birth:dob,consent_accepted:true}});
  if(error||!created.user)redirect("/pharmacie?erreur=caisse");
  const {error:profileError}=await db.from("profiles").update({role:"caisse",pharmacie_id:pharmacieId,parent_profile_id:userId,actif:true}).eq("id",created.user.id);
  if(profileError)redirect("/pharmacie?erreur=caisse");
  redirect("/pharmacie?ok=caisse");
}

export async function bloquerCaisse(formData:FormData){
  const {userId,pharmacieId}=await exigerPromoteur();
  const caisseId=value(formData,"caisse_id");
  if(!caisseId)redirect("/pharmacie?erreur=caisse");
  const {error}=await supabaseAdmin().from("profiles").update({actif:false}).eq("id",caisseId).eq("parent_profile_id",userId).eq("pharmacie_id",pharmacieId).eq("role","caisse");
  redirect(error?"/pharmacie?erreur=caisse":"/pharmacie?ok=blocage");
}

export async function reactiverCaisse(formData:FormData){
  const {userId,pharmacieId}=await exigerPromoteur();
  const caisseId=value(formData,"caisse_id");
  if(!caisseId)redirect("/pharmacie?erreur=caisse");
  const {error}=await supabaseAdmin().from("profiles").update({actif:true}).eq("id",caisseId).eq("parent_profile_id",userId).eq("pharmacie_id",pharmacieId).eq("role","caisse");
  redirect(error?"/pharmacie?erreur=caisse":"/pharmacie?ok=reactivation");
}
