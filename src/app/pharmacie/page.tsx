"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { importerStock } from "@/lib/importStock";
import { fcfa } from "@/lib/ranking";
import { Logo } from "@/components/Logo";
import { RappelsLotsBanner } from "@/components/pharmacie/RappelsLotsBanner";
import { EspaceNaxaSwitcher } from "@/components/EspaceNaxaSwitcher";
import { AppareilHorsLigne } from "@/components/pharmacie/AppareilHorsLigne";
import { enregistrerOperation, getLocalDeviceIdentity, readReference } from "@/lib/offline-db";

type Ligne={produit_id:string;prix:number;quantite:number;date_peremption:string|null;updated_at:string;emplacement:string|null;produits:{nom:string;dosage:string}|null};
type Resa={id:string;statut:string;total:number;expires_at:string;paiement_ref:string|null;reservation_items:{quantite:number;produits:{nom:string}|null}[]};

export default function PanneauPharmacie(){
 const sb=supabaseBrowser(),[pid,setPid]=useState<string|null>(null),[nom,setNom]=useState(""),[role,setRole]=useState(""),[stock,setStock]=useState<Ligne[]>([]),[resas,setResas]=useState<Resa[]>([]),[filtre,setFiltre]=useState(""),[msg,setMsg]=useState(""),[garde,setGarde]=useState(false),[canManageTeam,setCanManageTeam]=useState(false),[module,setModule]=useState<""|"marketplace"|"erp">(""),[offlineMode,setOfflineMode]=useState(false),[offlineSnapshotReady,setOfflineSnapshotReady]=useState(false);

 const charger=useCallback(async(id:string)=>{
  const [{data:s,error:se},{data:r,error:re},{data:ph,error:pe},{data:charges,error:ce},{data:couts,error:coe},{data:lots,error:le},{data:catalogue,error:catError}]=await Promise.all([
    sb.from("stocks").select("produit_id,prix,quantite,date_peremption,updated_at,emplacement,produits(nom,dosage)").eq("pharmacie_id",id),
    sb.from("reservations").select("id,statut,total,expires_at,paiement_ref,reservation_items(quantite,produits(nom))").eq("pharmacie_id",id).in("statut",["en_attente","confirmee","payee"]),
    sb.from("pharmacies").select("nom,de_garde").eq("id",id).single(),
    sb.from("depenses").select("*").eq("pharmacie_id",id).order("date_depense",{ascending:false}).limit(200),
    sb.from("stocks_couts").select("*").eq("pharmacie_id",id),
    sb.from("stocks_lots").select("*").eq("pharmacie_id",id),
    sb.from("produits").select("*").limit(2000)
  ]);
  if(se||re||pe||ce||coe||le||catError)return setMsg("Impossible de charger les données de référence. Vérifiez la connexion.");
  setStock((s??[]) as unknown as Ligne[]);setResas((r??[]) as unknown as Resa[]);setNom(ph?.nom??"");setGarde(Boolean(ph?.de_garde));
 },[sb]);

 const chargerSnapshotOffline=useCallback(async()=>{
  try{
   const saved=await readReference();
   const snapshot=saved?.value&&typeof saved.value==="object"?saved.value as Record<string,unknown>:null;
   const pharmacy=snapshot?.pharmacie&&typeof snapshot.pharmacie==="object"?snapshot.pharmacie as Record<string,unknown>:null;
   if(pharmacy?.id&&pharmacy.id!==pid){setMsg("Le stock local ne correspond pas à la pharmacie de cet appareil.");setOfflineSnapshotReady(false);return;}
   if(pharmacy&&typeof pharmacy.nom==="string")setNom(pharmacy.nom);
   setStock(Array.isArray(snapshot?.stock)?snapshot.stock as Ligne[]:[]);
   setOfflineSnapshotReady(true);
   setMsg(Array.isArray(snapshot?.stock)?"Instantané local déverrouillé. Seules les corrections de stock sont disponibles hors ligne.":"Aucun instantané de stock chiffré n'est disponible. Reconnectez le poste pour le synchroniser.");
  }catch{
   setOfflineSnapshotReady(false);
   setMsg("Impossible de lire l'instantané local chiffré. Les données restent conservées.");
  }
 },[pid]);

 useEffect(()=>{const value=new URLSearchParams(window.location.search).get("module");setModule(value==="marketplace"||value==="erp"?value:"")},[]);

 useEffect(()=>{let cancelled=false;void (async()=>{
  if(!navigator.onLine){
   const identity=await getLocalDeviceIdentity();
   if(cancelled)return;
   setOfflineMode(true);
   if(identity){setPid(identity.pharmacyId);setNom(identity.pharmacyName);setRole(identity.role??"pharmacie");}
   else setMsg("Connexion requise pour activer un poste hors ligne. Aucune association locale exploitable n'a été trouvée.");
   return;
  }
  const {data:u}=await sb.auth.getUser();
  if(!u.user){window.location.replace("/connexion?espace=pharmacie");return}
  const {data:p}=await sb.from("profiles").select("pharmacie_id,role,fonction_interne,actif").eq("id",u.user.id).single();
  if(p?.role==="promoteur"&&(p.actif!==true||new URLSearchParams(window.location.search).get("vue")!=="operation")){window.location.replace("/pharmacie/promoteur");return}
  if(!p||p.actif!==true||!["pharmacie","promoteur","caisse"].includes(p.role)||(p.role!=="promoteur"&&!p.pharmacie_id)){setMsg("Ce compte pharmacie est désactivé ou non lié à une pharmacie.");return}
  let targetPharmacyId=p.pharmacie_id;
  if(p.role==="promoteur"){
    const requestedPharmacyId=new URLSearchParams(window.location.search).get("pharmacie");
    if(requestedPharmacyId){
      targetPharmacyId=requestedPharmacyId;
    }else if(!targetPharmacyId){
      const {data:firstLink,error:firstLinkError}=await sb.from("promoteur_pharmacies").select("pharmacie_id").eq("promoteur_id",u.user.id).eq("actif",true).order("created_at",{ascending:true}).limit(1).maybeSingle();
      if(firstLinkError||!firstLink){setMsg("Aucune pharmacie active n’est rattachée à votre réseau.");return}
      targetPharmacyId=firstLink.pharmacie_id;
    }
    const {data:link,error:linkError}=await sb.from("promoteur_pharmacies").select("pharmacie_id").eq("promoteur_id",u.user.id).eq("pharmacie_id",targetPharmacyId).eq("actif",true).maybeSingle();
    if(linkError||!link){setMsg("Cette pharmacie ne fait pas partie de votre réseau actif.");return}
    const {data:target,error:targetError}=await sb.from("pharmacies").select("id,actif,visible_recherche").eq("id",targetPharmacyId).maybeSingle();
    if(targetError||!target?.actif||!target.visible_recherche){setMsg("Cette pharmacie n’est pas active et publiée. L’espace opérationnel reste fermé.");return}
  }
  if(!targetPharmacyId){setMsg("Aucune pharmacie n’est liée à ce compte.");return}
  if(p.fonction_interne==="responsable"){
    const {data:teamAccess,error:teamError}=await sb.rpc("naxa_can",{p_privilege:"VIEW_TEAM",p_pharmacie:targetPharmacyId,p_target:null});
    setCanManageTeam(!teamError&&teamAccess===true);
  }
  setRole(p.role);setPid(targetPharmacyId);await charger(targetPharmacyId);
})();return ()=>{cancelled=true}},[charger,sb]);

 async function statut(id:string,s:string){const {error}=await sb.rpc("set_reservation_status",{p_id:id,p_statut:s});setMsg(error?"Action impossible.":"Réservation mise à jour.");if(pid&&!error)charger(pid)}
 async function importer(f:File){if(!pid)return;if(!navigator.onLine)return setMsg("L'import Excel nécessite une connexion.");try{const r=await importerStock(f,pid);setMsg(`${r.importes} produits importés, ${r.ignores} lignes ignorées.`);charger(pid)}catch{setMsg("Import impossible. Vérifiez les colonnes Nom, Prix et Quantité.")}}
 async function quantite(l:Ligne,q:number){
  if(!pid)return;
  q=Math.max(0,Math.round(q)||0);
  if(!navigator.onLine||offlineMode){
   try{
    await enregistrerOperation("stock_set_quantity",{produit_id:l.produit_id,quantite:q});
    setMsg("Correction enregistrée localement. Elle sera synchronisée au retour de la connexion.");
   }catch(error){
    setMsg(error instanceof Error?error.message:"Correction hors ligne impossible. Vérifiez l'activation du poste.");
   }
   return;
  }
  const {data:res,error}=await sb.rpc("offline_stock_set_quantity",{p_operation_id:crypto.randomUUID(),p_pharmacie_id:pid,p_produit_id:l.produit_id,p_quantite:q,p_base_updated_at:l.updated_at});
  if(error||res?.status==="failed"){setMsg("Stock non modifié. Vérifiez la connexion et réessayez.");return}
  if(res?.status==="conflict"){setMsg("Le stock a changé sur le serveur. Rechargez les données avant de réessayer.");await charger(pid);return}
  setStock(x=>x.map(v=>v.produit_id===l.produit_id?{...v,quantite:q}:v));
  setMsg("Stock mis à jour.");await charger(pid)
 }
 async function changerGarde(v:boolean){if(!navigator.onLine)return setMsg("Le statut de garde nécessite une connexion.");const result=role==="promoteur"&&pid?await sb.rpc("set_garde_for_pharmacy",{p_pharmacie:pid,p_garde:v}):await sb.rpc("set_garde",{p_garde:v});if(result.error)return setMsg("Impossible de modifier le statut de garde. Vérifiez le périmètre, les privilèges et la validité du réseau.");setGarde(v);setMsg(v?"Pharmacie déclarée de garde.":"Pharmacie retirée de la garde.")}


 const vus=stock.filter(l=>(l.produits?.nom??"").toLowerCase().includes(filtre.toLowerCase()));
 if(offlineMode){
  return <main className="mx-auto min-h-dvh max-w-4xl px-4 pb-16">
   <header className="-mx-4 mb-5 flex items-center justify-between gap-3 bg-naxa-green-900 px-4 py-3 text-white"><Logo taille={32}/><span className="font-semibold">{nom||"Poste pharmacie"}</span></header>
   <section className="carte mb-4 space-y-2">
    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-naxa-green-700">Session locale chiffrée</p>
    <h1 className="text-xl font-extrabold text-naxa-green-900">Reprise hors ligne</h1>
    <p className="text-sm text-slate-600">Accès limité au stock de référence et aux corrections locales. Réservations, caisse, équipe, garde et paramètres restent indisponibles hors connexion.</p>
    {pid?<AppareilHorsLigne pharmacyId={pid} pharmacyName={nom} onUnlocked={chargerSnapshotOffline}/>:<p role="alert" className="text-sm text-amber-800">{msg}</p>}
   </section>
   {msg&&<p role="status" className="mb-3 text-sm">{msg}</p>}
   {offlineSnapshotReady&&<section className="space-y-3">
    <div><h2 className="text-lg font-extrabold">Stock local</h2><p className="text-xs text-slate-500">Instantané chiffré du dernier échange avec le serveur · les corrections sont mises en file et synchronisées au retour du réseau.</p></div>
    <input className="champ w-full" placeholder="Rechercher un produit" value={filtre} onChange={e=>setFiltre(e.target.value)}/>
    {vus.length===0?<p className="carte text-sm text-slate-600">Aucun produit dans cet instantané.</p>:<div className="carte overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-3 text-left">Produit</th><th className="p-3 text-left">Quantité</th><th className="p-3 text-left">Prix</th><th className="p-3 text-left">Emplacement</th></tr></thead><tbody>{vus.map(l=><tr key={l.produit_id} className="border-t"><td className="p-3">{l.produits?.nom} {l.produits?.dosage}</td><td className="p-3"><input aria-label={\`Quantité \${l.produits?.nom??"produit"}\`} type="number" min="0" inputMode="numeric" value={l.quantite} onChange={e=>setStock(x=>x.map(v=>v.produit_id===l.produit_id?{...v,quantite:Math.max(0,Number(e.target.value)||0)}:v))} onBlur={e=>quantite(l,Number(e.target.value))} className="w-24 rounded border p-2"/></td><td className="p-3">{fcfa(l.prix)}</td><td className="p-3">{l.emplacement??"—"}</td></tr>)}</tbody></table></div>}
   </section>}
   {navigator.onLine&&<button type="button" className="btn btn-clair mt-5" onClick={()=>window.location.reload()}>Recharger l’espace connecté</button>}
  </main>;
 }

 return <main className="mx-auto min-h-dvh max-w-4xl px-4 pb-16">
  {String(module)!=="marketplace"&&<RappelsLotsBanner pharmacieId={pid} />}
  {module===""&&<header className="-mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 bg-naxa-green-900 px-4 py-3 text-white"><Logo taille={32}/><span className="font-semibold">{nom}</span><EspaceNaxaSwitcher current="pharmacie" /></header>}
  {pid&&module===""&&<section aria-label="Vue d’ensemble de la pharmacie" className="mb-5 pt-2">
   <div className="mb-4">
    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-naxa-green-700">Tableau de bord</p>
    <h1 className="mt-1 text-2xl font-extrabold leading-tight text-naxa-green-900">Bonjour, {nom||"équipe pharmacie"}</h1>
    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Retrouvez en un coup d’œil vos réservations, votre stock et le statut de votre pharmacie.</p>
   </div>
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {String(module)!=="marketplace"&&<article className="carte flex min-h-28 flex-col justify-between"><p className="text-sm font-semibold text-slate-600">Produits suivis</p><p className="text-3xl font-extrabold tabular-nums text-naxa-green-900">{stock.length}</p><p className="text-xs text-slate-500">Références dans votre stock</p></article>}
    {String(module)!=="erp"&&<article className="carte flex min-h-28 flex-col justify-between"><p className="text-sm font-semibold text-slate-600">Réservations en cours</p><p className="text-3xl font-extrabold tabular-nums text-naxa-green-900">{resas.length}</p><p className="text-xs text-slate-500">À traiter par votre équipe</p></article>}
    {String(module)!=="erp"&&<article className="carte flex min-h-28 flex-col justify-between"><p className="text-sm font-semibold text-slate-600">Statut de garde</p><p className="text-xl font-extrabold text-naxa-green-900">{garde?"De garde":"Hors garde"}</p><span className={garde?"inline-flex w-fit items-center rounded-full bg-naxa-canari px-3 py-1 text-xs font-bold text-naxa-green-900":"inline-flex w-fit items-center rounded-full border border-naxa-green-100 bg-naxa-green-50 px-3 py-1 text-xs font-bold text-slate-600"}>{garde?"Visible comme pharmacie de garde":"Non déclarée de garde"}</span></article>}
   </div>
  </section>}
  {msg&&<p role="status" className="mb-3 text-sm">{msg}</p>}
  {pid&&role!=="promoteur"&&<AppareilHorsLigne pharmacyId={pid} pharmacyName={nom}/>}
  {String(module)!=="marketplace"&&<div className="mb-3 flex flex-wrap justify-end gap-2">{role==="promoteur"&&<a href="/pharmacie/promoteur" className="btn btn-canari">Pilotage Promoteur / réseau</a>}{role==="promoteur"&&<a href="/pharmacie/caisses" className="btn btn-clair">Gestion de l’équipe</a>}<a href="/pharmacie/rappels-lots" className="btn btn-clair">Lots / rappels</a><a href="/pharmacie/caisse" className="btn btn-vert">Caisse / Encaissement</a>{role!=="promoteur"&&<a href="/pharmacie/pharmacien" className="btn btn-clair">Espace Pharmacien</a>}{canManageTeam&&<a href="/pharmacie/caisses" className="btn btn-canari">Gestion de l’équipe</a>}</div>}{String(module)!=="erp"&&<><section className="carte mb-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-extrabold">Statut de la pharmacie</h1><p className="text-sm">Indiquez si l&apos;équipe est actuellement de garde.</p></div><button type="button" className={garde?"btn btn-canari":"btn btn-clair"} onClick={()=>changerGarde(!garde)} aria-pressed={garde}>{garde?"✓ De garde":"Déclarer de garde"}</button></div></section>
  <h2 className="text-xl font-extrabold">Réservations en cours ({resas.length})</h2>{resas.length===0&&<p className="my-3 text-sm">Aucune réservation en cours.</p>}{resas.map(r=><div key={r.id} className="carte my-3"><p className="font-bold">N° {r.id.slice(0,8).toUpperCase()} · {fcfa(r.total)} · {r.statut}</p><p>{r.reservation_items.map(i=>`${i.quantite} × ${i.produits?.nom}`).join(", ")}</p><div className="flex flex-wrap gap-2">{r.statut==="en_attente"&&<button className="btn btn-vert" onClick={()=>statut(r.id,"confirmee")}>Confirmer</button>}{["en_attente","confirmee"].includes(r.statut)&&<button className="btn btn-canari" onClick={()=>statut(r.id,"payee")}>Paiement reçu</button>}{["confirmee","payee"].includes(r.statut)&&<button className="btn btn-vert" onClick={()=>statut(r.id,"retiree")}>Remise au client</button>}<button className="btn btn-clair" onClick={()=>statut(r.id,"annulee")}>Annuler</button></div></div>)}</>}
  {String(module)!=="marketplace"&&<section className="mt-10"><h2 className="text-xl font-extrabold">Mon stock</h2><div className="flex flex-wrap gap-2"><input className="champ flex-1" placeholder="Rechercher" value={filtre} onChange={e=>setFiltre(e.target.value)}/><label className="btn btn-clair">Importer Excel<input type="file" hidden accept=".xlsx,.xls,.csv" onChange={e=>e.target.files?.[0]&&importer(e.target.files[0])}/></label></div><p className="mt-2 text-xs">Formats : Excel (.xlsx/.xls) ou CSV. Colonnes reconnues : nom/désignation/produit, prix, quantité, dosage/conditionnement, péremption.</p><div className="carte mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-3 text-left">Produit</th><th className="p-3 text-left">Quantité</th><th className="p-3 text-left">Prix</th><th className="p-3 text-left">Emplacement</th></tr></thead><tbody>{vus.map(l=><tr key={l.produit_id} className="border-t"><td className="p-3">{l.produits?.nom} {l.produits?.dosage}</td><td className="p-3"><input aria-label={`Quantité ${l.produits?.nom??"produit"}`} type="number" min="0" inputMode="numeric" value={l.quantite} onChange={e=>setStock(x=>x.map(v=>v.produit_id===l.produit_id?{...v,quantite:Math.max(0,Number(e.target.value)||0)}:v))} onBlur={e=>quantite(l,Number(e.target.value))} className="w-24 rounded border p-2"/></td><td className="p-3">{fcfa(l.prix)}</td><td className="p-3">{l.emplacement??"—"}</td></tr>)}</tbody></table></div></section>}
 </main>;
}
