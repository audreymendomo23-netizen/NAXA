"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Ord={id:string;document_ref:string|null;created_at:string;motif_rejet:string|null;client_id:string|null;statut:string};

export default function PharmacienPage(){
  const sb=supabaseBrowser();
  const [rows,setRows]=useState<Ord[]>([]),[msg,setMsg]=useState(""),[pid,setPid]=useState<string|null>(null),[motif,setMotif]=useState<Record<string,string>>({});
  async function charger(id:string){const {data,error}=await sb.from("prescriptions").select("id,document_ref,created_at,motif_rejet,client_id,statut").eq("pharmacie_id",id).eq("statut","en_attente").order("created_at",{ascending:true});if(error)setMsg(error.message);else setRows((data??[]) as Ord[])}
  useEffect(()=>{(async()=>{const {data:u}=await sb.auth.getUser();if(!u.user)return setMsg("Connexion requise.");const {data:p}=await sb.from("profiles").select("fonction_interne,role,pharmacie_id,actif").eq("id",u.user.id).single();if(!p?.pharmacie_id||p.actif===false||!["pharmacien","pharmacien_assistant"].includes(p.fonction_interne??""))return setMsg("Accès Pharmacien non autorisé.");setPid(p.pharmacie_id);charger(p.pharmacie_id)})()},[sb]);
  async function decider(id:string,ok:boolean){const {error}=await sb.rpc("prescription_valider",{p_prescription:id,p_accepter:ok,p_motif:motif[id]??null});setMsg(error?error.message:(ok?"Ordonnance validée.":"Ordonnance rejetée."));if(!error&&pid)charger(pid)}
  return <main className="mx-auto max-w-3xl px-4 pb-16"><header className="-mx-4 mb-4 bg-naxa-green-900 px-4 py-3 text-white"><a href="/pharmacie">← Pharmacie</a><b className="ml-4">Espace Pharmacien</b></header><section className="carte"><h1 className="text-xl font-extrabold">Ordonnances à valider</h1><p className="text-sm mt-1">Le Pharmacien contrôle la prescription avant toute délivrance nécessitant une ordonnance.</p></section>{msg&&<p role="status" className="my-3 carte">{msg}</p>}{rows.length===0&&<p className="my-4 text-sm">Aucune ordonnance en attente.</p>}{rows.map(r=><article key={r.id} className="carte my-3 space-y-3"><div><b>Ordonnance {r.id.slice(0,8).toUpperCase()}</b><p className="text-sm">Déposée le {new Date(r.created_at).toLocaleString("fr-FR")}</p>{r.document_ref&&<p className="text-sm">Document : {r.document_ref}</p>}</div><div className="flex flex-wrap gap-2"><button className="btn btn-vert" onClick={()=>decider(r.id,true)}>Valider l'ordonnance</button><button className="btn btn-clair" onClick={()=>decider(r.id,false)}>Rejeter</button></div><textarea className="champ min-h-20 w-full" placeholder="Motif obligatoire en cas de rejet / observation" value={motif[r.id]??""} onChange={e=>setMotif(x=>({...x,[r.id]:e.target.value}))}/></article>)}</main>;
}
