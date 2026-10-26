"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { supabaseAdmin } from "@/lib/supabase/server";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANAUX = new Set(["especes", "orange_money", "mtn_momo", "virement", "depot_bancaire", "autre"]);
export async function enregistrerReglementPromoteur(formData: FormData) {
 const { user } = await requireAdminActive("/admin/pilotage/reglements");
 const promoteurId=String(formData.get("promoteur_id")??"");
 const montant=Number(formData.get("montant"));
 const canal=String(formData.get("canal")??"");
 const canalAutre=String(formData.get("canal_autre")??"").trim();
 const reference=String(formData.get("reference")??"").trim();
 const payeLeRaw=String(formData.get("paye_le")??"").trim();
 const preuve=formData.get("preuve");
 if(!UUID.test(promoteurId)||!Number.isSafeInteger(montant)||montant<=0||!CANAUX.has(canal)) redirect("/admin/pilotage/reglements?erreur=champs");
 if(canal==="autre"&&(canalAutre.length<2||canalAutre.length>80)) redirect("/admin/pilotage/reglements?erreur=canal");
 if(!(preuve instanceof File)||preuve.size<=0||preuve.size>8*1024*1024) redirect("/admin/pilotage/reglements?erreur=preuve");
 const extensions:Record<string,string>={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
 const extension=extensions[preuve.type];
 if(!extension) redirect("/admin/pilotage/reglements?erreur=format");
 let payeLe:string|null=null;
 if(payeLeRaw){const d=new Date(payeLeRaw);if(!Number.isFinite(d.getTime())||d.getTime()>Date.now()+5*60_000)redirect("/admin/pilotage/reglements?erreur=date");payeLe=d.toISOString();}
 const db=supabaseAdmin();
 const {data:profile,error:profileError}=await db.from("profiles").select("id,role").eq("id",promoteurId).maybeSingle();
 if(profileError||!profile||profile.role!=="promoteur")redirect("/admin/pilotage/reglements?erreur=promoteur");
 const proofPath=promoteurId+"/"+crypto.randomUUID()+"."+extension;
 const {error:uploadError}=await db.storage.from("preuves-reglements-promoteurs").upload(proofPath,preuve,{contentType:preuve.type,upsert:false});
 if(uploadError)redirect("/admin/pilotage/reglements?erreur=upload");
 const {error}=await db.rpc("admin_enregistrer_reglement_promoteur",{p_promoteur:promoteurId,p_montant:montant,p_canal:canal,p_canal_autre:canalAutre||null,p_reference:reference||null,p_paye_le:payeLe,p_preuve_path:proofPath,p_admin:user.id});
 if(error){await db.storage.from("preuves-reglements-promoteurs").remove([proofPath]);redirect("/admin/pilotage/reglements?erreur="+(error.message.toLowerCase().includes("attente")?"deja_attente":"enregistrement"));}
 revalidatePath("/admin/pilotage/reglements");revalidatePath("/promoteur/paiements");revalidatePath("/notifications");
 redirect("/admin/pilotage/reglements?ok=enregistre");
}
export async function confirmerReglementPromoteur(formData:FormData){
 const {user}=await requireAdminActive("/admin/pilotage/reglements");
 const id=String(formData.get("reglement_id")??"");
 if(!UUID.test(id))redirect("/admin/pilotage/reglements?erreur=champs");
 const db=supabaseAdmin();
 const {error}=await db.rpc("admin_confirmer_reglement_promoteur",{p_reglement:id,p_admin:user.id});
 if(error)redirect("/admin/pilotage/reglements?erreur=confirmation");
 revalidatePath("/admin/pilotage/reglements");revalidatePath("/promoteur/paiements");revalidatePath("/notifications");
 redirect("/admin/pilotage/reglements?ok=confirme");
}