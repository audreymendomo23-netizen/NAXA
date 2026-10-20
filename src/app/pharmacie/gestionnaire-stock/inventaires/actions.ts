"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

async function scope() {
 const sb=supabaseServer();
 const {data:auth}=await sb.auth.getUser();
 if(!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/inventaires");
 const {data:p,error}=await sb.from("profiles").select("role,fonction_interne,actif").eq("id",auth.user.id).maybeSingle();
 const role=String(p?.role??"").toLowerCase(), fn=String(p?.fonction_interne??"").toLowerCase();
 if(error||!p||p.actif===false||!(role==="admin"||role==="promoteur"||["pharmacien","pharmacien_assistant","responsable","gestionnaire_stock","magasinier"].includes(fn))) redirect("/");
 const {data:rows,error:e}=await sb.rpc("my_pharmacies");
 const pharmacies=(Array.isArray(rows)?rows:[]) as {pharmacie_id?:string;id?:string}[];
 const ids=[...new Set(pharmacies.map(x=>x.pharmacie_id??x.id).filter((x):x is string=>Boolean(x)))];
 if(e||!ids.length) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=perimetre");
 return {sb,uid:auth.user.id,ids};
}
export async function creerInventaireStock(formData:FormData) {
 const {sb,uid,ids}=await scope();
 const type=String(formData.get("type")??"complet");
 const pharmacie=String(formData.get("pharmacie_id")??"");
 if(!ids.includes(pharmacie)||!["complet","cible"].includes(type)) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=validation");
 const reference=String(formData.get("reference")??"").trim().slice(0,80)||null;
 const {data,error}=await sb.from("inventaires").insert({pharmacie_id:pharmacie,type,statut:"en_cours",reference,started_at:new Date().toISOString(),created_by:uid}).select("id").single();
 if(error||!data) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=creation");
 if(type==="complet") {
  const {data:stocks}=await sb.from("stocks").select("produit_id").eq("pharmacie_id",pharmacie).limit(1000);
  for(const stock of stocks??[]) {
   const {error:lineError}=await sb.rpc("inventaire_preparer_ligne",{p_inventaire:data.id,p_produit:stock.produit_id,p_lot:null});
   if(lineError) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=preparation");
  }
 }
 revalidatePath("/pharmacie/gestionnaire-stock/inventaires");
 redirect("/pharmacie/gestionnaire-stock/inventaires?ok=cree");
}
export async function compterLigneInventaire(formData:FormData) {
 const {sb}=await scope();
 const id=String(formData.get("ligne_id")??"");
 const raw=String(formData.get("quantite_comptee")??"");
 const qty=Number(raw);
 if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isSafeInteger(qty)||qty<0) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=comptage");
 const {error}=await sb.from("inventaire_lignes").update({quantite_comptee:qty}).eq("id",id);
 if(error) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=comptage");
 revalidatePath("/pharmacie/gestionnaire-stock/inventaires");
}
export async function cloturerInventaireStock(formData:FormData) {
 const {sb}=await scope();
 const id=String(formData.get("inventaire_id")??"");
 if(!/^[0-9a-f-]{36}$/i.test(id)) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=validation");
 const {error}=await sb.rpc("inventaire_cloturer",{p_inventaire:id});
 if(error) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=cloture");
 revalidatePath("/pharmacie/gestionnaire-stock/inventaires");
 redirect("/pharmacie/gestionnaire-stock/inventaires?ok=cloture");
}

export async function ajouterLigneInventaireStock(formData:FormData) {
 const {sb,ids}=await scope();
 const inventaire=String(formData.get("inventaire_id")??"");
 const produit=String(formData.get("produit_id")??"");
 if(!/^[0-9a-f-]{36}$/i.test(inventaire)||!/^[0-9a-f-]{36}$/i.test(produit)) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=validation");
 const {data:inv,error:invError}=await sb.from("inventaires").select("id,pharmacie_id,statut").eq("id",inventaire).maybeSingle();
 if(invError||!inv||!ids.includes(inv.pharmacie_id)||!["brouillon","en_cours"].includes(inv.statut)) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=validation");
 const {data:stock,error:stockError}=await sb.from("stocks").select("produit_id").eq("pharmacie_id",inv.pharmacie_id).eq("produit_id",produit).maybeSingle();
 if(stockError||!stock) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=produit");
 const {error}=await sb.rpc("inventaire_preparer_ligne",{p_inventaire:inventaire,p_produit:produit,p_lot:null});
 if(error) redirect("/pharmacie/gestionnaire-stock/inventaires?erreur=ligne");
 revalidatePath("/pharmacie/gestionnaire-stock/inventaires");
 redirect("/pharmacie/gestionnaire-stock/inventaires?ok=ligne");
}
