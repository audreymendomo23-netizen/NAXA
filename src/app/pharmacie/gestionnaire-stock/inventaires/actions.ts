"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

async function scope() {
 const sb=supabaseServer();
 const {data:auth}=await sb.auth.getUser();
 if(!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/inventaires");
 const {data:p,error}=await sb.from("profiles").select("role,fonction_interne,actif").eq("id",auth.user.id).maybeSingle();
 const role=String(p?.role??"").toLowerCase(),fn=String(p?.fonction_interne??"").toLowerCase();
 const now=new Date().toISOString();
 const {data:assignments,error:ae}=await sb.from("naxa_professional_assignments").select("pharmacie_id")
  .eq("profile_id",auth.user.id).eq("statut","active").in("fonction",["gestionnaire_stock","magasinier"])
  .lte("commence_at",now).gt("expire_at",now);
 const hasAssignment=!ae&&Array.isArray(assignments)&&assignments.length>0;
 if(error||!p||p.actif===false||!(role==="admin"||role==="promoteur"||["pharmacien","pharmacien_assistant","responsable","gestionnaire_stock","magasinier"].includes(fn)||hasAssignment)) redirect("/");
 const {data:raw,error:e}=await sb.rpc("my_pharmacies");
 const ids=[...new Set([...(Array.isArray(raw)?raw:[]).filter((id):id is string=>typeof id==="string"),...(hasAssignment?assignments.map(a=>a.pharmacie_id).filter((id):id is string=>typeof id==="string"):[])])];
 if((e&&!hasAssignment)||!ids.length) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=perimetre");
 return {sb,uid:auth.user.id,ids};
}
export async function creerInventaireStock(formData:FormData) {
 const {sb,ids}=await scope();
 const type=String(formData.get("type")??"complet");
 const pharmacie=String(formData.get("pharmacie_id")??"");
 const reference=String(formData.get("reference")??"").trim().slice(0,80)||null;
 if(!ids.includes(pharmacie)||!["complet","cible"].includes(type)) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=validation");
 const {data,error}=await sb.rpc("gestionnaire_stock_inventaire_demarrer",{p_pharmacie:pharmacie,p_type:type,p_reference:reference});
 if(error||!data) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=creation");
 revalidatePath("/pharmacie/gestionnaire-stock");
 revalidatePath("/pharmacie/gestionnaire-stock/inventaires");
 redirect("/pharmacie/gestionnaire-stock/inventaires?ok=cree");
}
export async function compterLigneInventaire(formData:FormData) {
 const {sb}=await scope();
 const id=String(formData.get("ligne_id")??"");
 const raw=String(formData.get("quantite_comptee")??"");
 const qty=Number(raw);
 if(!raw.trim()||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!Number.isSafeInteger(qty)||qty<0) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=comptage");
 const {error}=await sb.rpc("gestionnaire_stock_inventaire_compter",{p_ligne:id,p_quantite:qty});
 if(error) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=comptage");
 revalidatePath("/pharmacie/gestionnaire-stock");
 revalidatePath("/pharmacie/gestionnaire-stock/inventaires");
}
export async function cloturerInventaireStock(formData:FormData) {
 const {sb}=await scope();
 const id=String(formData.get("inventaire_id")??"");
 if(!/^[0-9a-f-]{36}$/i.test(id)) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=validation");
 const {error}=await sb.rpc("inventaire_cloturer",{p_inventaire:id});
 if(error) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=cloture");
 revalidatePath("/pharmacie/gestionnaire-stock");
 revalidatePath("/pharmacie/gestionnaire-stock/inventaires");
 redirect("/pharmacie/gestionnaire-stock/inventaires?ok=cloture");
}

export async function ajouterLigneInventaireStock(formData:FormData) {
 const {sb,ids}=await scope();
 const inventaire=String(formData.get("inventaire_id")??"");
 const produit=String(formData.get("produit_id")??"");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(inventaire)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(produit)) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=validation");
 const {data:inv,error:invError}=await sb.from("inventaires").select("id,pharmacie_id,statut").eq("id",inventaire).maybeSingle();
 if(invError||!inv||!ids.includes(inv.pharmacie_id)||!["brouillon","en_cours"].includes(inv.statut)) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=validation");
 const {data,error}=await sb.rpc("gestionnaire_stock_inventaire_ajouter_produit",{p_inventaire:inventaire,p_produit:produit});
 if(error||!data) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=ligne");
 revalidatePath("/pharmacie/gestionnaire-stock");
 revalidatePath("/pharmacie/gestionnaire-stock/inventaires");
 redirect("/pharmacie/gestionnaire-stock/inventaires?ok=ligne");
}

export async function annulerInventaireStock(formData:FormData) {
 const {sb,ids}=await scope();
 const inventaire=String(formData.get("inventaire_id")??"");
 const confirmation=formData.get("confirmation")==="oui";
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(inventaire)||!confirmation)redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=annulation");
 const {data:inv,error:invError}=await sb.from("inventaires").select("id,pharmacie_id,statut").eq("id",inventaire).maybeSingle();
 if(invError||!inv||!ids.includes(inv.pharmacie_id)||!["brouillon","en_cours"].includes(inv.statut))redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=annulation");
 const {data,error}=await sb.rpc("gestionnaire_stock_inventaire_annuler",{p_inventaire:inventaire});
 if(error||data!==true)redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=annulation");
 revalidatePath("/pharmacie/gestionnaire-stock");
 revalidatePath("/pharmacie/gestionnaire-stock/inventaires");
 redirect("/pharmacie/gestionnaire-stock/inventaires?ok=annule");
}
