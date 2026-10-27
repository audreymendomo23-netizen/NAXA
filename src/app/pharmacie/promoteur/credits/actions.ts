"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
const valid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function decide(formData:FormData,approve:boolean){
 const sb=supabaseServer();const {data:auth}=await sb.auth.getUser();
 if(!auth.user)redirect("/connexion?retour=/pharmacie/promoteur/credits");
 const id=String(formData.get("demande_id")??"");if(!valid(id))redirect("/pharmacie/promoteur/credits?erreur=reference");
 const {data:p}=await sb.from("profiles").select("role,actif").eq("id",auth.user.id).maybeSingle();
 if(!p||p.role!=="promoteur"||p.actif===false)redirect("/");
 const {error}=await sb.rpc("client_credit_demande_decider",{p_demande:id,p_approuver:approve});
 if(error)redirect("/pharmacie/promoteur/credits?erreur=decision");
 revalidatePath("/pharmacie/promoteur/credits");revalidatePath("/pharmacie/gestionnaire-stock/reservations");
 redirect("/pharmacie/promoteur/credits?ok="+(approve?"approuvee":"rejetee"));
}
export async function approuverDemandeCreditMarketplace(formData:FormData){return decide(formData,true);}
export async function refuserDemandeCreditMarketplace(formData:FormData){return decide(formData,false);}
