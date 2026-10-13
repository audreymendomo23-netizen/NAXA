"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { FilMessages } from "@/components/FilMessages";
import { Logo } from "@/components/Logo";

type Fil = { fil_id: string; libelle: string; dernier_message: string | null; date_dernier_message: string | null; non_lus: number };
export default function MessagesPharmaciePage() {
 const [pharmacie,setPharmacie]=useState(""); const [fils,setFils]=useState<Fil[]>([]); const [actif,setActif]=useState<string|null>(null); const [erreur,setErreur]=useState("");
 useEffect(()=>{void(async()=>{const sb=supabaseBrowser();const {data,error}=await sb.rpc("my_pharmacies");if(error){setErreur("Impossible de charger vos pharmacies.");return;}const rows=Array.isArray(data)?data:[];const id=rows[0]?.pharmacie_id??rows[0]?.id;if(!id){setErreur("Aucune pharmacie accessible.");return;}setPharmacie(id);const {data:boite,error:e}=await sb.rpc("boite_pharmacie",{p_pharmacie:id});if(e)setErreur("Boîte de réception indisponible.");else setFils((boite??[]) as Fil[]);})();},[]);
 return <main className="mx-auto min-h-screen max-w-2xl px-4 pb-24"><header className="-mx-4 flex items-center gap-3 bg-naxa-green-900 px-4 py-3"><Link href="/"><Logo taille={32}/></Link><h1 className="font-bold text-white">Messages pharmacie</h1></header>{erreur&&<p role="alert" className="mt-4 text-red-700">{erreur}</p>}<ul className="mt-4 space-y-3">{fils.map(f=><li key={f.fil_id} className="carte"><button className="w-full text-left" onClick={()=>setActif(f.fil_id)}><div className="flex justify-between gap-2"><strong>{f.libelle}</strong>{Number(f.non_lus)>0&&<span className="rounded-full bg-naxa-canari px-2 text-xs font-bold">{f.non_lus}</span>}</div><p className="mt-1 truncate text-sm text-slate-600">{f.dernier_message}</p></button>{actif===f.fil_id&&<FilMessages filId={f.fil_id} role="pharmacie"/>}</li>)}</ul>{pharmacie&&fils.length===0&&!erreur&&<p className="mt-4 text-slate-600">Aucun message pour le moment.</p>}</main>;
}
