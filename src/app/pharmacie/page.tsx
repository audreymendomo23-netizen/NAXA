"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { importerStock } from "@/lib/importStock";
import { fcfa } from "@/lib/ranking";
import { Logo } from "@/components/Logo";

type Ligne={produit_id:string;prix:number;quantite:number;date_peremption:string|null;updated_at:string;emplacement:string|null;produits:{nom:string;dosage:string}|null};
type Resa={id:string;statut:string;total:number;expires_at:string;paiement_ref:string|null;reservation_items:{quantite:number;produits:{nom:string}|null}[]};

export default function PanneauPharmacie(){
 const sb=supabaseBrowser(),[pid,setPid]=useState<string|null>(null),[nom,setNom]=useState(""),[role,setRole]=useState(""),[stock,setStock]=useState<Ligne[]>([]),[resas,setResas]=useState<Resa[]>([]),[filtre,setFiltre]=useState(""),[msg,setMsg]=useState(""),[garde,setGarde]=useState(false);

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


 useEffect(()=>{(async()=>{
  if(!navigator.onLine){setMsg("Connexion internet requise pour accéder à l’espace pharmacie.");return}
  const {data:u}=await sb.auth.getUser();
  if(!u.user){window.location.replace("/connexion?espace=pharmacie");return}
  const {data:p}=await sb.from("profiles").select("pharmacie_id,role,actif").eq("id",u.user.id).single();
  if(!p?.pharmacie_id||p.actif===false||!["pharmacie","promoteur","caisse"].includes(p.role)){setMsg("Ce compte pharmacie est désactivé ou non lié à une pharmacie.");return}
  setRole(p.role);setPid(p.pharmacie_id);await charger(p.pharmacie_id);
})()},[charger,sb]);

 async function statut(id:string,s:string){const {error}=await sb.rpc("set_reservation_status",{p_id:id,p_statut:s});setMsg(error?"Action impossible.":"Réservation mise à jour.");if(pid&&!error)charger(pid)}
 async function importer(f:File){if(!pid)return;if(!navigator.onLine)return setMsg("L'import Excel nécessite une connexion.");try{const r=await importerStock(f,pid);setMsg(`${r.importes} produits importés, ${r.ignores} lignes ignorées.`);charger(pid)}catch{setMsg("Import impossible. Vérifiez les colonnes Nom, Prix et Quantité.")}}
 async function quantite(l:Ligne,q:number){
  if(!pid)return;
  if(!navigator.onLine){setMsg("Connexion internet requise pour modifier le stock.");return}
  q=Math.max(0,Math.round(q)||0);
  const {data:res,error}=await sb.rpc("offline_stock_set_quantity",{p_operation_id:crypto.randomUUID(),p_pharmacie_id:pid,p_produit_id:l.produit_id,p_quantite:q,p_base_updated_at:l.updated_at});
  if(error||res?.status==="failed"){setMsg("Stock non modifié. Vérifiez la connexion et réessayez.");return}
  if(res?.status==="conflict"){setMsg("Le stock a changé sur le serveur. Rechargez les données avant de réessayer.");await charger(pid);return}
  setStock(x=>x.map(v=>v.produit_id===l.produit_id?{...v,quantite:q}:v));
  setMsg("Stock mis à jour.");await charger(pid)
 }
 async function changerGarde(v:boolean){if(!navigator.onLine)return setMsg("Le statut de garde nécessite une connexion.");const {error}=await sb.rpc("set_garde",{p_garde:v});if(error)return setMsg("Impossible de modifier le statut de garde.");setGarde(v);setMsg(v?"Pharmacie déclarée de garde.":"Pharmacie retirée de la garde.")}

 const vus=stock.filter(l=>(l.produits?.nom??"").toLowerCase().includes(filtre.toLowerCase()));
 return <main className="mx-auto min-h-dvh max-w-4xl px-4 pb-16">
  <header className="-mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 bg-naxa-green-900 px-4 py-3 text-white"><Logo taille={32}/><span className="font-semibold">{nom}</span></header>
  {pid&&<section aria-label="Vue d’ensemble de la pharmacie" className="mb-5 pt-2">
   <div className="mb-4">
    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-naxa-green-700">Tableau de bord</p>
    <h1 className="mt-1 text-2xl font-extrabold leading-tight text-naxa-green-900">Bonjour, {nom||"équipe pharmacie"}</h1>
    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Retrouvez en un coup d’œil vos réservations, votre stock et le statut de votre pharmacie.</p>
   </div>
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <article className="carte flex min-h-28 flex-col justify-between">
     <p className="text-sm font-semibold text-slate-600">Produits suivis</p>
     <p className="text-3xl font-extrabold tabular-nums text-naxa-green-900">{stock.length}</p>
     <p className="text-xs text-slate-500">Références dans votre stock</p>
    </article>
    <article className="carte flex min-h-28 flex-col justify-between">
     <p className="text-sm font-semibold text-slate-600">Réservations en cours</p>
     <p className="text-3xl font-extrabold tabular-nums text-naxa-green-900">{resas.length}</p>
     <p className="text-xs text-slate-500">À traiter par votre équipe</p>
    </article>
    <article className="carte flex min-h-28 flex-col justify-between">
     <p className="text-sm font-semibold text-slate-600">Statut de garde</p>
     <p className="text-xl font-extrabold text-naxa-green-900">{garde?"De garde":"Hors garde"}</p>
     <span className={garde?"inline-flex w-fit items-center rounded-full bg-naxa-canari px-3 py-1 text-xs font-bold text-naxa-green-900":"inline-flex w-fit items-center rounded-full border border-naxa-green-100 bg-naxa-green-50 px-3 py-1 text-xs font-bold text-slate-600"}>{garde?"Visible comme pharmacie de garde":"Non déclarée de garde"}</span>
    </article>
   </div>
  </section>}
  {msg&&<p role="status" className="mb-3 text-sm">{msg}</p>}
  <div className="mb-3 flex flex-wrap justify-end gap-2">{role==="promoteur"&&<a href="/pharmacie/promoteur" className="btn btn-canari">Pilotage Promoteur / réseau</a>}{role==="promoteur"&&<a href="/pharmacie/caisses" className="btn btn-clair">Gestion de l’équipe</a>}<a href="/pharmacie/caisse" className="btn btn-vert">Caisse / Encaissement</a><a href="/pharmacie/pharmacien" className="btn btn-clair">Espace Pharmacien</a></div><section className="carte mb-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-extrabold">Statut de la pharmacie</h1><p className="text-sm">Indiquez si l&apos;équipe est actuellement de garde.</p></div><button type="button" className={garde?"btn btn-canari":"btn btn-clair"} onClick={()=>changerGarde(!garde)} aria-pressed={garde}>{garde?"✓ De garde":"Déclarer de garde"}</button></div></section>
  <h2 className="text-xl font-extrabold">Réservations en cours ({resas.length})</h2>{resas.length===0&&<p className="my-3 text-sm">Aucune réservation en cours.</p>}{resas.map(r=><div key={r.id} className="carte my-3"><p className="font-bold">N° {r.id.slice(0,8).toUpperCase()} · {fcfa(r.total)} · {r.statut}</p><p>{r.reservation_items.map(i=>`${i.quantite} × ${i.produits?.nom}`).join(", ")}</p><div className="flex flex-wrap gap-2">{r.statut==="en_attente"&&<button className="btn btn-vert" onClick={()=>statut(r.id,"confirmee")}>Confirmer</button>}{["en_attente","confirmee"].includes(r.statut)&&<button className="btn btn-canari" onClick={()=>statut(r.id,"payee")}>Paiement reçu</button>}{["confirmee","payee"].includes(r.statut)&&<button className="btn btn-vert" onClick={()=>statut(r.id,"retiree")}>Remise au client</button>}<button className="btn btn-clair" onClick={()=>statut(r.id,"annulee")}>Annuler</button></div></div>)}
  <section className="mt-10"><h2 className="text-xl font-extrabold">Mon stock</h2><div className="flex flex-wrap gap-2"><input className="champ flex-1" placeholder="Rechercher" value={filtre} onChange={e=>setFiltre(e.target.value)}/><label className="btn btn-clair">Importer Excel<input type="file" hidden accept=".xlsx,.xls,.csv" onChange={e=>e.target.files?.[0]&&importer(e.target.files[0])}/></label></div><p className="mt-2 text-xs">Formats : Excel (.xlsx/.xls) ou CSV. Colonnes reconnues : nom/désignation/produit, prix, quantité, dosage/conditionnement, péremption.</p><div className="carte mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-3 text-left">Produit</th><th className="p-3 text-left">Quantité</th><th className="p-3 text-left">Prix</th><th className="p-3 text-left">Emplacement</th></tr></thead><tbody>{vus.map(l=><tr key={l.produit_id} className="border-t"><td className="p-3">{l.produits?.nom} {l.produits?.dosage}</td><td className="p-3"><input aria-label={`Quantité ${l.produits?.nom??"produit"}`} type="number" min="0" inputMode="numeric" value={l.quantite} onChange={e=>setStock(x=>x.map(v=>v.produit_id===l.produit_id?{...v,quantite:Math.max(0,Number(e.target.value)||0)}:v))} onBlur={e=>quantite(l,Number(e.target.value))} className="w-24 rounded border p-2"/></td><td className="p-3">{fcfa(l.prix)}</td><td className="p-3">{l.emplacement??"—"}</td></tr>)}</tbody></table></div></section>
 </main>;
}
