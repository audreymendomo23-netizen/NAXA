"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Ord={id:string;document_ref:string|null;created_at:string;motif_rejet:string|null;client_id:string|null;statut:string;consultation_id?:string|null};

export default function PharmacienPage(){
  const sb=supabaseBrowser();
  const [pid,setPid]=useState<string|null>(null),[accessType,setAccessType]=useState<"pharmacien"|"pharmacien_assistant"|"promoteur"|null>(null),[tab,setTab]=useState<"consultation"|"prescription"|"validation">("consultation");
  const [internal,setInternal]=useState<Ord[]>([]),[incoming,setIncoming]=useState<Ord[]>([]);
  const [msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[motif,setMotif]=useState<Record<string,string>>({});
  const [consult,setConsult]=useState({patient:"",clientId:"",motif:"",observations:"",conclusion:"",recommandations:""});
  const [presc,setPresc]=useState({patient:"",clientId:"",consultationId:"",designation:"",quantite:"1",posologie:"",duree:"",instructions:"",commentaire:""});

  async function charger(id:string,canCreer:boolean=true){
    const receivedPromise=sb.from("prescriptions").select("id,document_ref,created_at,motif_rejet,client_id,statut").eq("pharmacie_id",id).eq("source","client").eq("statut","en_attente").order("created_at",{ascending:true});
    const minePromise=canCreer?sb.rpc("pharmacien_prescriptions_recentes",{p_pharmacie:id,p_limite:30}):Promise.resolve({data:[],error:null});
    const [mine,received]=await Promise.all([minePromise,receivedPromise]);
    if((canCreer&&mine.error)||received.error)return setMsg((canCreer?mine.error?.message:null)??received.error?.message??"Impossible de charger les ordonnances.");
    setInternal((canCreer?(mine.data??[]):[]) as Ord[]);setIncoming((received.data??[]) as Ord[]);
  }

  useEffect(()=>{(async()=>{
    const {data:u}=await sb.auth.getUser();if(!u.user)return setMsg("Connexion requise.");
    const {data:p}=await sb.from("profiles").select("role,fonction_interne,pharmacie_id,actif").eq("id",u.user.id).single();
    const type=p?.role==="promoteur"?"promoteur":p?.fonction_interne;
    if(!p?.pharmacie_id||p.actif===false||!["promoteur","pharmacien","pharmacien_assistant"].includes(type??""))return setMsg("Accès Pharmacien non autorisé.");
    setPid(p.pharmacie_id);setAccessType(type as "promoteur"|"pharmacien"|"pharmacien_assistant");
    const canCreer=type==="pharmacien";setTab(canCreer?"consultation":"validation");await charger(p.pharmacie_id,canCreer);
  })()},[sb]);

  async function creerConsultation(){
    if(!pid)return;setBusy(true);
    const {data,error}=await sb.rpc("pharmacien_creer_consultation",{p_pharmacie:pid,p_patient_nom:consult.patient,p_motif:consult.motif,p_client_id:consult.clientId.trim()||null,p_observations:consult.observations,p_conclusion:consult.conclusion,p_recommandations:consult.recommandations});
    setBusy(false);if(error)return setMsg(error.message);
    setPresc(x=>({...x,patient:consult.patient,clientId:consult.clientId,consultationId:data}));setMsg("Consultation enregistrée.");setTab("prescription");
  }

  async function creerPrescription(){
    if(!pid)return;setBusy(true);
    const {data,error}=await sb.rpc("pharmacien_creer_prescription",{p_pharmacie:pid,p_patient_nom:presc.patient,p_client_id:presc.clientId.trim()||null,p_consultation_id:presc.consultationId.trim()||null,p_designation:presc.designation,p_quantite:Number(presc.quantite),p_posologie:presc.posologie,p_duree:presc.duree,p_instructions:presc.instructions,p_commentaire:presc.commentaire});
    setBusy(false);if(error)return setMsg(error.message);
    setMsg("Prescription émise et enregistrée.");setPresc(x=>({...x,designation:"",quantite:"1",posologie:"",duree:"",instructions:"",commentaire:""}));if(pid)charger(pid,true);setTab("validation");
  }

  async function decider(id:string,ok:boolean){
    const {error}=await sb.rpc("prescription_valider",{p_prescription:id,p_accepter:ok,p_motif:motif[id]??null});
    setMsg(error?error.message:(ok?"Ordonnance validée.":"Ordonnance rejetée."));if(!error&&pid)charger(pid,accessType==="pharmacien");
  }

  return <main className="mx-auto max-w-4xl px-4 pb-16">
    <header className="-mx-4 mb-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3 text-white"><a href="/pharmacie">← Pharmacie</a><b>Espace Pharmacien</b></header>
    {msg&&<p role="status" className="my-3 carte">{msg}</p>}
    <section className="carte mb-4">
      <h1 className="text-xl font-extrabold">Consultation, prescription et délivrance</h1>
      <p className="mt-1 text-sm">{accessType==="pharmacien"?"Le Pharmacien peut enregistrer une consultation, émettre une prescription et contrôler les ordonnances reçues.":"Ce compte peut contrôler les ordonnances reçues ; la création de consultations et prescriptions est réservée à la fonction Pharmacien."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {accessType==="pharmacien"&&<button className={tab==="consultation"?"btn btn-vert":"btn btn-clair"} onClick={()=>setTab("consultation")}>Consultation</button>}
        {accessType==="pharmacien"&&<button className={tab==="prescription"?"btn btn-vert":"btn btn-clair"} onClick={()=>setTab("prescription")}>Prescription</button>}
        <button className={tab==="validation"?"btn btn-vert":"btn btn-clair"} onClick={()=>setTab("validation")}>Ordonnances ({incoming.length})</button>
      </div>
    </section>

    {tab==="consultation"&&accessType==="pharmacien"&&<section className="carte space-y-3">
      <h2 className="text-lg font-bold">Nouvelle consultation pharmaceutique</h2>
      <label className="block text-sm font-semibold">Nom du patient<input className="champ mt-1 w-full" value={consult.patient} onChange={e=>setConsult(x=>({...x,patient:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">ID client NAXA (facultatif)<input className="champ mt-1 w-full" value={consult.clientId} onChange={e=>setConsult(x=>({...x,clientId:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Motif<input className="champ mt-1 w-full" value={consult.motif} onChange={e=>setConsult(x=>({...x,motif:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Observations<textarea className="champ mt-1 min-h-24 w-full" value={consult.observations} onChange={e=>setConsult(x=>({...x,observations:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Conclusion<textarea className="champ mt-1 min-h-20 w-full" value={consult.conclusion} onChange={e=>setConsult(x=>({...x,conclusion:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Recommandations<textarea className="champ mt-1 min-h-20 w-full" value={consult.recommandations} onChange={e=>setConsult(x=>({...x,recommandations:e.target.value}))}/></label>
      <button disabled={busy} className="btn btn-vert w-full" onClick={creerConsultation}>{busy?"Enregistrement…":"Enregistrer la consultation et passer à la prescription"}</button>
    </section>}

    {tab==="prescription"&&accessType==="pharmacien"&&<section className="carte space-y-3">
      <h2 className="text-lg font-bold">Émettre une prescription</h2>
      <label className="block text-sm font-semibold">Nom du patient<input className="champ mt-1 w-full" value={presc.patient} onChange={e=>setPresc(x=>({...x,patient:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">ID client NAXA (facultatif)<input className="champ mt-1 w-full" value={presc.clientId} onChange={e=>setPresc(x=>({...x,clientId:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Consultation liée (facultatif)<input className="champ mt-1 w-full" value={presc.consultationId} onChange={e=>setPresc(x=>({...x,consultationId:e.target.value}))}/></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Produit / désignation<input className="champ mt-1 w-full" value={presc.designation} onChange={e=>setPresc(x=>({...x,designation:e.target.value}))}/></label><label className="block text-sm font-semibold">Quantité<input className="champ mt-1 w-full" type="number" min="1" value={presc.quantite} onChange={e=>setPresc(x=>({...x,quantite:e.target.value}))}/></label></div>
      <label className="block text-sm font-semibold">Posologie<input className="champ mt-1 w-full" value={presc.posologie} onChange={e=>setPresc(x=>({...x,posologie:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Durée<input className="champ mt-1 w-full" value={presc.duree} onChange={e=>setPresc(x=>({...x,duree:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Instructions<textarea className="champ mt-1 min-h-20 w-full" value={presc.instructions} onChange={e=>setPresc(x=>({...x,instructions:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Commentaire interne<textarea className="champ mt-1 min-h-20 w-full" value={presc.commentaire} onChange={e=>setPresc(x=>({...x,commentaire:e.target.value}))}/></label>
      <button disabled={busy} className="btn btn-vert w-full" onClick={creerPrescription}>{busy?"Enregistrement…":"Émettre la prescription"}</button>
    </section>}

    {tab==="validation"&&<div className="space-y-4">
      <section className="carte"><h2 className="text-lg font-bold">Ordonnances reçues à contrôler</h2>{incoming.length===0&&<p className="my-3 text-sm">Aucune ordonnance en attente.</p>}
        {incoming.map(r=><article key={r.id} className="carte my-3 space-y-3"><div><b>Ordonnance {r.id.slice(0,8).toUpperCase()}</b><p className="text-sm">{new Date(r.created_at).toLocaleString("fr-FR")}</p>{r.document_ref&&<p className="text-sm">Document : {r.document_ref}</p>}</div><textarea className="champ min-h-20 w-full" placeholder="Motif obligatoire si rejet" value={motif[r.id]??""} onChange={e=>setMotif(x=>({...x,[r.id]:e.target.value}))}/><div className="flex flex-wrap gap-2"><button className="btn btn-vert" onClick={()=>decider(r.id,true)}>Valider</button><button className="btn btn-clair" onClick={()=>decider(r.id,false)}>Rejeter</button></div></article>)}
      </section>
      <section className="carte"><h2 className="text-lg font-bold">Prescriptions émises par la pharmacie</h2>{internal.length===0&&<p className="my-3 text-sm">Aucune prescription interne récente.</p>}{internal.map(r=><article key={r.id} className="carte my-3"><b>Prescription {r.id.slice(0,8).toUpperCase()}</b><p className="text-sm">{new Date(r.created_at).toLocaleString("fr-FR")} · {r.statut}</p>{r.consultation_id&&<p className="text-sm">Consultation liée : {r.consultation_id.slice(0,8).toUpperCase()}</p>}</article>)}</section>
    </div>}
  </main>;
}
