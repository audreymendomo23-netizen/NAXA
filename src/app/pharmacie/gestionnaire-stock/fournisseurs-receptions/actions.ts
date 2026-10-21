"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
async function authorized(){
 const sb=supabaseServer();const {data:auth}=await sb.auth.getUser();
 if(!auth.user)redirect("/connexion?retour=/pharmacie/gestionnaire-stock/fournisseurs-receptions");
 const {data:p,error}=await sb.from("profiles").select("role,fonction_interne,actif").eq("id",auth.user.id).maybeSingle();
 const role=String(p?.role??"").toLowerCase(),fn=String(p?.fonction_interne??"").toLowerCase();
 if(error||!p||p.actif===false||!(role==="admin"||role==="promoteur"||["pharmacien","pharmacien_assistant","responsable","gestionnaire_stock","magasinier"].includes(fn)))redirect("/");
 const {data:raw,error:e}=await sb.rpc("my_pharmacies");const ids=[...new Set((Array.isArray(raw)?raw:[]).filter((id):id is string=>typeof id==="string"))];
 if(e||!ids.length)redirect("/pharmacie/gestionnaire-stock/fournisseurs-receptions?erreur=perimetre");
 return {sb,uid:auth.user.id,ids};
}
const uuid=(x:string)=>/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(x);
const back="/pharmacie/gestionnaire-stock/fournisseurs-receptions";
export async function creerFournisseurStock(formData:FormData){
 const {sb,uid}=await authorized();const nom=String(formData.get("nom")??"").trim();
 const contact=String(formData.get("contact")??"").trim(),telephone=String(formData.get("telephone")??"").trim(),email=String(formData.get("email")??"").trim();
 if(nom.length<2||nom.length>160||contact.length>160||telephone.length>40||email.length>160||(email!==""&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))redirect(back+"?erreur=fournisseur");
 const {error}=await sb.from("fournisseurs").insert({nom,contact:contact||null,telephone:telephone||null,email:email||null,created_by:uid});
 if(error)redirect(back+"?erreur=fournisseur");
 revalidatePath(back);redirect(back+"?ok=fournisseur");
}
export async function creerCommandeFournisseurStock(formData:FormData){
 const {sb,uid,ids}=await authorized();const pharmacie=String(formData.get("pharmacie_id")??""),fournisseur=String(formData.get("fournisseur_id")??""),reference=String(formData.get("reference")??"").trim();
 if(!ids.includes(pharmacie)||!uuid(fournisseur)||reference.length>100)redirect(back+"?erreur=commande");
 const {data:supplier,error:supplierError}=await sb.from("fournisseurs").select("id").eq("id",fournisseur).eq("actif",true).maybeSingle();
 if(supplierError||!supplier)redirect(back+"?erreur=fournisseur");
 const {error}=await sb.from("commandes_fournisseurs").insert({pharmacie_id:pharmacie,fournisseur_id:fournisseur,reference:reference||null,statut:"brouillon",created_by:uid});
 if(error)redirect(back+"?erreur=commande");
 revalidatePath(back);redirect(back+"?ok=commande");
}
export async function ajouterLigneCommandeFournisseurStock(formData:FormData){
 const {sb,ids}=await authorized();const commande=String(formData.get("commande_id")??""),produit=String(formData.get("produit_id")??"");
 const quantite=Number(formData.get("quantite_commandee")),prixRaw=String(formData.get("prix_unitaire_prevu")??"");
 const prix=prixRaw===""?null:Number(prixRaw);
 if(!uuid(commande)||!uuid(produit)||!Number.isSafeInteger(quantite)||quantite<=0||quantite>100000||!(prix===null||(Number.isSafeInteger(prix)&&prix>=0)))redirect(back+"?erreur=ligne");
 const {data:order,error:orderError}=await sb.from("commandes_fournisseurs").select("id,pharmacie_id,statut").eq("id",commande).maybeSingle();
 if(orderError||!order||!ids.includes(order.pharmacie_id)||order.statut!=="brouillon")redirect(back+"?erreur=ligne");
 const {error:productError,data:stock}=await sb.from("stocks").select("produit_id").eq("pharmacie_id",order.pharmacie_id).eq("produit_id",produit).maybeSingle();
 if(productError||!stock)redirect(back+"?erreur=produit");
 const {error}=await sb.from("commandes_fournisseurs_lignes").insert({commande_id:commande,produit_id:produit,quantite_commandee:quantite,prix_unitaire_prevu:prix});
 if(error)redirect(back+"?erreur=ligne");
 revalidatePath(back);redirect(back+"?ok=ligne");
}
export async function recevoirCommandeFournisseurStock(formData:FormData){
 const {sb,ids}=await authorized();const commande=String(formData.get("commande_id")??"");
 if(!uuid(commande))redirect(back+"?erreur=reception");
 const {data:order,error:orderError}=await sb.from("commandes_fournisseurs").select("id,pharmacie_id,statut,commandes_fournisseurs_lignes(id,quantite_commandee,quantite_recue)").eq("id",commande).maybeSingle();
 if(orderError||!order||!ids.includes(order.pharmacie_id)||!["envoyee","partielle"].includes(order.statut))redirect(back+"?erreur=reception");
 const lines=(order as unknown as {commandes_fournisseurs_lignes:{id:string;quantite_commandee:number;quantite_recue:number}[]}).commandes_fournisseurs_lignes??[];
 const received=lines.map(line=>({commande_ligne_id:line.id,quantite_recue:Number(formData.get("qty_"+line.id)??0),quantite_max:line.quantite_commandee-line.quantite_recue,numero_lot:String(formData.get("lot_"+line.id)??"").trim(),date_peremption:String(formData.get("expiry_"+line.id)??""),emplacement:String(formData.get("location_"+line.id)??"").trim()}));
 if(received.some(line=>!Number.isSafeInteger(line.quantite_recue)||line.quantite_recue<0||line.quantite_recue>line.quantite_max))redirect(back+"?erreur=reception");
 const payload=received.filter(line=>line.quantite_recue>0).map(({quantite_max,...line})=>line);
 if(!payload.length)redirect(back+"?erreur=reception");
 const reference=String(formData.get("reference_reception")??"").trim();const commentaire=String(formData.get("commentaire")??"").trim();
 if(reference.length>100||commentaire.length>500)redirect(back+"?erreur=reception");
 const {error}=await sb.rpc("fournisseur_reception_enregistrer",{p_commande:commande,p_lignes:payload,p_reference:reference||null,p_commentaire:commentaire||null});
 if(error)redirect(back+"?erreur=reception");
 revalidatePath(back);revalidatePath("/pharmacie/gestionnaire-stock");revalidatePath("/pharmacie/gestionnaire-stock/stock-logistique");revalidatePath("/pharmacie/gestionnaire-stock/lots-peremptions");revalidatePath("/pharmacie/gestionnaire-stock/historique-rapports");
 redirect(back+"?ok=reception");
}

export async function envoyerCommandeFournisseurStock(formData:FormData){
 const {sb,ids}=await authorized();const commande=String(formData.get("commande_id")??"");
 if(!uuid(commande))redirect(back+"?erreur=envoi");
 const {data:order,error:orderError}=await sb.from("commandes_fournisseurs").select("id,pharmacie_id,statut,commandes_fournisseurs_lignes(id,quantite_commandee)").eq("id",commande).maybeSingle();
 if(orderError||!order||!ids.includes(order.pharmacie_id)||order.statut!=="brouillon")redirect(back+"?erreur=envoi");
 const lines=(order as unknown as {commandes_fournisseurs_lignes:{id:string;quantite_commandee:number}[]}).commandes_fournisseurs_lignes??[];
 if(!lines.length)redirect(back+"?erreur=commande_vide");
 const {data,error}=await sb.rpc("fournisseur_commande_envoyer",{p_commande:commande});
 if(error||data!==true)redirect(back+"?erreur=envoi");
 revalidatePath(back);redirect(back+"?ok=envoyee");
}
