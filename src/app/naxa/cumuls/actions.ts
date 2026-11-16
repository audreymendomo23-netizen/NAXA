"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function deciderCumulProfessionnel(formData:FormData){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/naxa/cumuls");
  const approvalId=String(formData.get("approval_id")??"").trim();
  const decision=String(formData.get("decision")??"").trim();
  const reason=String(formData.get("decision_reason")??"").trim();
  if(!uuid.test(approvalId)||!["approve","reject"].includes(decision)
    ||(decision==="reject"&&reason.length<5)||reason.length>500){
    redirect("/naxa/cumuls?erreur=validation");
  }
  const {data:status,error}=await sb.rpc("naxa_decide_cumulative_activity",{
    p_approval_id:approvalId,p_decision:decision,p_reason:reason||null,
  });
  if(error)redirect("/naxa/cumuls?erreur=autorisation");
  revalidatePath("/naxa/cumuls");
  revalidatePath("/pharmacie/affectations");
  revalidatePath("/partenaire/prestations");
  revalidatePath("/admin");
  redirect("/naxa/cumuls?ok="+(status==="approved"?"approuve":status==="rejected"?"refuse":status==="cancelled"?"annule":"decision"));
}
