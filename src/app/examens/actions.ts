"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export async function reserverExamen(form:FormData){
 const sb=supabaseServer();
 const {data:auth}=await sb.auth.getUser();
 if(!auth.user) redirect("/connexion?retour=/examens");
 const {data:profile,error:profileError}=await sb.from("profiles").select("role").eq("id",auth.user.id).maybeSingle();
 if(profileError || profile?.role!=="client") redirect("/examens?erreur=compte");
 const slotId=String(form.get("slot_id")??"");
 const serviceId=String(form.get("service_id")??"");
 const packId=String(form.get("pack_id")??"");
 if(!uuid(slotId)||((serviceId.length>0)===(packId.length>0))||(serviceId&&!uuid(serviceId))||(packId&&!uuid(packId))) redirect("/examens?erreur=validation");
 const {error}=await sb.rpc("book_exam_appointment",{p_slot_id:slotId,p_service_id:serviceId||null,p_pack_id:packId||null,p_client_note:null});
 if(error) redirect("/examens?erreur=indisponible");
 revalidatePath("/examens");revalidatePath("/achats");revalidatePath("/client");revalidatePath("/partenaire/examens");revalidatePath("/admin/examens");
 redirect("/examens?ok=1");
}
