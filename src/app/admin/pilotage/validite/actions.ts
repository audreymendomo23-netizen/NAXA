"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin,supabaseServer } from "@/lib/supabase/server";

async function exigerAdmin(){
 const sb=supabaseServer();
 const{data:u}=await sb.auth.getUser();
 if(!u.user)redirect("/connexion?retour=/admin/pilotage/validite");
 const{data:p}=await sb.from("profiles").select("role").eq("id",u.user.id).single();
 if(p?.role!=="admin")redirect("/");
}
export async function reactiverPromoteur(formData:FormData){
 await exigerAdmin();
 const promoteurId=String(formData.get("promoteur_id")||"");
 const reference=String(formData.get("reference")||"").trim()||null;
 if(!promoteurId)return;
 const db=supabaseAdmin();
 const{error}=await db.rpc("reactiver_promoteur",{p_promoteur:promoteurId,p_reference:reference});
 if(error)redirect("/admin/pilotage/validite?erreur="+encodeURIComponent(error.message));
 revalidatePath("/admin/pilotage");
 revalidatePath("/admin/pilotage/validite");
 redirect("/admin/pilotage/validite?ok=1");
}
