"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { Barres, Liste, Section, Tuile, useTempsReel } from "@/components/Pilotage";

type Stats={role:string;pharmacies:{total:number;actives:number;inactives:number};recherches:{total:number;sans_resultat:number};entonnoir:{recherches:number;fiches_vues:number;paniers:number;reservations:number;ventes:number};ca:number;stock:{produits_en_stock:number;ruptures:number};alertes:number;serie:{jour:string;recherches:number;reservations:number;ventes:number}[]};

export default function PilotagePharmacie(){
 const[jours,setJours]=useState(7),[d,setD]=useState<Stats|null>(null),[err,setErr]=useState("");
 const load=useCallback(async()=>{const sb=supabaseBrowser();const{data,error}=await sb.rpc("stats_pilotage_scope",{p_jours:jours});if(error){setErr("Accès refusé ou données indisponibles.");return}setErr("");setD(data as Stats)},[jours]);
 useTempsReel(load,(cb)=>{const sb=supabaseBrowser();const c=sb.channel("naxa-pharmacie-pilotage").on("postgres_changes",{event:"*",schema:"public",table:"reservations"},cb).on("postgres_changes",{event:"*",schema:"public",table:"stocks"},cb).on("postgres_changes",{event:"*",schema:"public",table:"alertes"},cb).subscribe();return()=>{void sb.removeChannel(c)}});
 const pct=(a:number,b:number)=>b?Math.round(a/b*100)+" %":"—";
 const titre=d?.role==="promoteur"?"Pilotage Promoteur":d?.role==="responsable"?"Pilotage Responsable":d?.role==="caisse"?"Mon activité":"Pilotage pharmacie";
 return <main className="min-h-screen bg-[#ACDC76] p-3 sm:p-6"><div className="mx-auto max-w-7xl space-y-4">
  <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-black p-4 text-white"><div><p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Pilotage</p><h1 className="text-2xl font-black text-[#D95304] sm:text-3xl">{titre}</h1></div><Link href="/pharmacie" className="rounded-full border border-white px-4 py-2 text-sm">Espace opérationnel</Link></header>
  <nav className="flex gap-2 overflow-x-auto">{[7,30,90].map(j=><button key={j} onClick={()=>setJours(j)} className={`min-h-11 rounded-full px-5 text-sm font-bold ${jours===j?"bg-[#0147BB] text-white":"border-2 border-[#0147BB] text-[#0147BB]"}`}>{j} jours</button>)}</nav>
  {err&&<div role="alert" className="rounded-3xl bg-white p-4 text-red-700">{err}</div>}{!d&&!err&&<div className="rounded-3xl bg-white p-6">Chargement…</div>}
  {d&&<><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Tuile titre="Pharmacies autorisées" valeur={d.pharmacies.total} note={`${d.pharmacies.actives} actives · ${d.pharmacies.inactives} inactives`}/><Tuile titre="Recherches" valeur={d.recherches.total} note={`${pct(d.recherches.sans_resultat,d.recherches.total)} sans résultat`}/><Tuile titre="Ventes" valeur={d.entonnoir.ventes} note={`${d.entonnoir.reservations} réservations`}/><Tuile titre="CA" valeur={fcfa(d.ca)} note={`${d.alertes} alerte(s) non lue(s)`} alerte={d.alertes>0}/></div>
   <div className="grid gap-4 lg:grid-cols-2"><Section titre="Entonnoir"><Liste vide="" lignes={[{cle:"r",texte:"Recherches",valeur:String(d.entonnoir.recherches)},{cle:"f",texte:"Fiches vues",valeur:`${d.entonnoir.fiches_vues} · ${pct(d.entonnoir.fiches_vues,d.entonnoir.recherches)}`},{cle:"p",texte:"Ajouts panier",valeur:`${d.entonnoir.paniers} · ${pct(d.entonnoir.paniers,d.entonnoir.fiches_vues)}`},{cle:"s",texte:"Réservations",valeur:`${d.entonnoir.reservations} · ${pct(d.entonnoir.reservations,d.entonnoir.recherches)}`},{cle:"v",texte:"Ventes",valeur:`${d.entonnoir.ventes} · ${pct(d.entonnoir.ventes,d.entonnoir.reservations)}`}]}/></Section><Section titre="Stock"><Liste vide="" lignes={[{cle:"ok",texte:"Produits disponibles",valeur:String(d.stock.produits_en_stock)},{cle:"ko",texte:"Ruptures",valeur:String(d.stock.ruptures)}]}/></Section></div>
   <Section titre="Activité des 30 derniers jours"><Barres points={d.serie.map(x=>({jour:x.jour,n:x.reservations}))} etiquette="Réservations quotidiennes"/></Section>
  </>}
 </div></main>
}