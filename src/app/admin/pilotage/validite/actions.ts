"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdminActive } from "@/lib/admin/require-admin-active";

async function exigerAdmin(){
 const { user } = await requireAdminActive("/admin/pilotage/validite");
 return user.id;
}
export async function reactiverPromoteur(formData:FormData){
 const adminId=await exigerAdmin();
 const promoteurId=String(formData.get("promoteur_id")||"");
 const echeance=String(formData.get("echeance")||"");
 const motif=String(formData.get("motif")||"").trim();
 const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(echeance) && (() => { const d = new Date(`${echeance}T00:00:00.000Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === echeance; })();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(promoteurId) || !dateValide || motif.length<5 || motif.length>500) redirect("/admin/pilotage/validite?erreur=champs");
 const db=supabaseAdmin();
 const{error}=await db.rpc("admin_renouveler_promoteur",{p_promoteur:promoteurId,p_nouvelle_echeance:echeance,p_motif:motif,p_admin:adminId});
 if(error)redirect("/admin/pilotage/validite?erreur="+encodeURIComponent(error.message));
 revalidatePath("/admin/pilotage");
 revalidatePath("/admin/pilotage/validite");
 revalidatePath("/admin/promoteurs");
 redirect("/admin/pilotage/validite?ok=renouvellement");
}
