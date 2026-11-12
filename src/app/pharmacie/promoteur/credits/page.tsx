import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { approuverDemandeCreditMarketplace, refuserDemandeCreditMarketplace } from "./actions";

type CreditRequest={id:string;pharmacie_id:string;client_id:string;montant:number;statut:string;created_at:string;telephone_demande:string|null;date_remboursement:string|null;justificatif_path:string|null;panier_items:{produit_id:string;quantite:number}[]|null;reservation_id:string|null};
const fcfa=(v:number)=>Number(v||0).toLocaleString("fr-FR")+" FCFA";
const ref=(v:string)=>v.replace(/-/g,"").slice(0,8).toUpperCase();

export default async function CreditsMarketplacePage({searchParams}:{searchParams:Promise<{ok?:string;erreur?:string}>}){
 const params=await searchParams;
 const sb=supabaseServer();const {data:auth}=await sb.auth.getUser();
 if(!auth.user)redirect("/connexion?retour=/pharmacie/promoteur/credits");
 const {data:profile}=await sb.from("profiles").select("role,actif,niveau_interne").eq("id",auth.user.id).maybeSingle();
 if(!profile||profile.role!=="promoteur"||profile.actif===false||profile.niveau_interne!==1)redirect("/");
 const {data:scope,error:scopeError}=await sb.rpc("my_pharmacies");
 const ids=Array.isArray(scope)?scope.filter((v):v is string=>typeof v==="string"):[];
 if(scopeError||!ids.length)return <main className="p-5"><h1 className="text-2xl font-black">Crédits Marketplace</h1><p role="alert">Périmètre pharmacie indisponible. Aucune demande n’a été modifiée.</p></main>;
 const {data,error}=await sb.from("client_credit_requests").select("id,pharmacie_id,client_id,montant,statut,created_at,telephone_demande,date_remboursement,justificatif_path,panier_items,reservation_id").eq("origine","marketplace").in("pharmacie_id",ids).order("created_at",{ascending:false}).limit(100);
 const requests=(data??[]) as CreditRequest[];
 const pids=[...new Set(requests.flatMap(r=>(r.panier_items??[]).map(i=>i.produit_id)))];
 const {data:products}=pids.length?await sb.from("produits").select("id,nom,dosage").in("id",pids):{data:[] as {id:string;nom:string;dosage:string|null}[]};
 const names=new Map((products??[]).map(p=>[p.id,p.nom+(p.dosage?" "+p.dosage:"")]));
 return <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
 <header className="rounded-2xl bg-[#0B3D26] p-5 text-white"><h1 className="text-2xl font-black">Demandes de crédit Marketplace</h1><p className="mt-2 text-sm">L’approbation débite immédiatement le stock physique et affecte les lots FEFO. La commande est ensuite transmise à la préparation.</p></header>
 {params.ok&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm">{params.ok==="approuvee"?"Crédit approuvé, stock débité et commande transmise à la préparation.":"Demande refusée ; aucun stock n’a été débité."}</p>}
 {params.erreur&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm">Décision non enregistrée. Vérifiez le statut, les droits et le stock.</p>}
 {error&&<p role="alert" className="rounded-xl bg-red-50 p-3">Impossible de charger les demandes.</p>}
 {!error&&!requests.length&&<p className="rounded-xl border bg-white p-4">Aucune demande Marketplace enregistrée.</p>}
 {requests.map(r=><article key={r.id} className="space-y-3 rounded-2xl border bg-white p-4">
 <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">Demande #{ref(r.id)}</h2><p className="text-sm">Client #{ref(r.client_id)} · {r.telephone_demande??"Téléphone absent"}</p><p className="text-sm">Échéance : {r.date_remboursement??"Non renseignée"}</p><p className="text-xs text-slate-500">Soumise le {new Date(r.created_at).toLocaleString("fr-FR")}</p></div><div className="text-right"><p className="text-xl font-black">{fcfa(r.montant)}</p><p className="text-sm font-bold">{r.statut}</p></div></div>
 <div className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-sm">Médicaments demandés</p><ul className="mt-2 space-y-1 text-sm">{(r.panier_items??[]).map(i=><li key={i.produit_id}>{i.quantite} × {names.get(i.produit_id)??"Produit"}</li>)}</ul></div>
 <p className="text-sm">{r.justificatif_path?<a className="font-bold underline" href={"/api/pharmacie/promoteur/credits/"+r.id+"/justificatif"}>Télécharger le justificatif sécurisé</a>:"Aucun justificatif référencé."}</p>
 {r.reservation_id&&<p className="text-sm">Commande de préparation : {ref(r.reservation_id)} · transmise à la Gestionnaire de stock.</p>}
 {r.statut==="en_attente"&&<div className="flex flex-wrap gap-3 border-t pt-3"><form action={approuverDemandeCreditMarketplace}><input type="hidden" name="demande_id" value={r.id}/><button className="rounded-xl bg-[#0B3D26] px-4 py-3 font-bold text-white" type="submit">Approuver et débiter le stock</button></form><form action={refuserDemandeCreditMarketplace}><input type="hidden" name="demande_id" value={r.id}/><button className="rounded-xl border border-red-300 px-4 py-3 font-bold text-red-800" type="submit">Refuser</button></form></div>}
 </article>)}
 </main>;
}
