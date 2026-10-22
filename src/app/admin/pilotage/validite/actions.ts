"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin,supabaseServer } from "@/lib/supabase/server";

async function exigerAdmin(){
 const sb=supabaseServer();
 const{data:u}=await sb.auth.getUser();
 if(!u.user)redirect("/connexion?retour=/admin/pilotage/validite");
 const{data:p}=await sb.from("profiles").select("role,actif").eq("id",u.user.id).single();
 if(p?.role!=="admin" || p.actif!==true)redirect("/");
 return u.user.id;
}
export async function reactiverPromoteur(formData:FormData){
 const adminId=await exigerAdmin();
 const promoteurId=String(formData.get("promoteur_id")||"");
 const echeance=String(formData.get("echeance")||"");
 const motif=String(formData.get("motif")||"").trim();
 if(!promoteurId || !/^\\d{4}-\\d{2}-\\d{2}$/.test(echeance) || motif.length<5) redirect("/admin/pilotage/validite?erreur=champs");
 const db=supabaseAdmin();
 const{error}=await db.rpc("admin_renouveler_promoteur",{p_promoteur:promoteurId,p_nouvelle_echeance:echeance,p_motif:motif,p_admin:adminId});
 if(error)redirect("/admin/pilotage/validite?erreur="+encodeURIComponent(error.message));
 revalidatePath("/admin/pilotage");
 revalidatePath("/admin/pilotage/validite");
 revalidatePath("/admin/promoteurs");
 redirect("/admin/pilotage/validite?ok=renouvellement");
}
