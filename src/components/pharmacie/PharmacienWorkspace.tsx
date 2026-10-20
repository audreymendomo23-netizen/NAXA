"use client";

import { useEffect, useMemo, useState } from "react";
import { PharmacienWorkspaceShell } from "@/components/pharmacie/PharmacienWorkspaceShell";
import { supabaseBrowser } from "@/lib/supabase/client";

type Ord={id:string;document_ref:string|null;created_at:string;motif_rejet:string|null;client_id:string|null;statut:string;consultation_id?:string|null};
type Preparation={prescription_id:string;statut:string;notes_preparation:string|null;motif_complement:string|null;updated_at:string};
type AuditEvent={id:string;actor_user_id:string|null;entity_type:"consultation"|"prescription"|"preparation";entity_id:string;action:string;old_status:string|null;new_status:string|null;reason:string|null;occurred_at:string;metadata:Record<string,unknown>};
type Consultation={id:string;client_id:string|null;patient_nom:string;motif:string;created_by:string;created_at:string;conclusion:string|null};

export function PharmacienWorkspace({ initialTab = "dashboard" }: { initialTab?: "dashboard" | "consultation" | "prescription" | "ordonnances" | "preparations" | "dispositifs" | "historique" | "rapports" | "profil" }) {
  const sb=useMemo(() => supabaseBrowser(), []);
  const [pid,setPid]=useState<string|null>(null),[tab,setTab]=useState<"dashboard"|"consultation"|"prescription"|"ordonnances"|"preparations"|"dispositifs"|"historique"|"rapports"|"profil">(initialTab);
  const [profileInfo,setProfileInfo]=useState<{first_name:string|null;last_name:string|null;phone:string|null;username:string|null;email:string}>({first_name:null,last_name:null,phone:null,username:null,email:""});
  const [profileTab,setProfileTab]=useState<"compte"|"securite"|"preferences"|"activite">("compte");
  const [newPassword,setNewPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState(""),[passwordBusy,setPasswordBusy]=useState(false);
  const [textSize,setTextSize]=useState<"normal"|"grand">("normal"),[compactDisplay,setCompactDisplay]=useState(false),[preferencesReady,setPreferencesReady]=useState(false);
  const [internal,setInternal]=useState<Ord[]>([]),[incoming,setIncoming]=useState<Ord[]>([]),[preparations,setPreparations]=useState<Record<string,Preparation>>({});
  const [consultations,setConsultations]=useState<Consultation[]>([]),[consultSearch,setConsultSearch]=useState("");
  const [auditEvents,setAuditEvents]=useState<AuditEvent[]>([]),[auditError,setAuditError]=useState("");
  const [msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[motif,setMotif]=useState<Record<string,string>>({}),[notesPreparation,setNotesPreparation]=useState<Record<string,string>>({});
  const [historySearch,setHistorySearch]=useState(""),[historyType,setHistoryType]=useState("toutes"),[historyFrom,setHistoryFrom]=useState(""),[historyTo,setHistoryTo]=useState("");
  const [reportPeriod,setReportPeriod]=useState<"jour"|"7jours"|"30jours"|"tout">("30jours");
  const [consult,setConsult]=useState({patient:"",clientId:"",motif:"",observations:"",conclusion:"",recommandations:""});
  const [presc,setPresc]=useState({patient:"",clientId:"",consultationId:"",designation:"",quantite:"1",posologie:"",duree:"",instructions:"",commentaire:""});

  async function charger(id:string){
    const [mine,received,prep]=await Promise.all([
      sb.rpc("pharmacien_prescriptions_recentes",{p_pharmacie:id,p_limite:30}),
      sb.from("prescriptions").select("id,document_ref,created_at,motif_rejet,client_id,statut").eq("pharmacie_id",id).eq("source","client").eq("statut","en_attente").order("created_at",{ascending:true}),
      sb.from("prescription_preparations").select("prescription_id,statut,notes_preparation,motif_complement,updated_at").eq("pharmacie_id",id).order("updated_at",{ascending:false}).limit(100)
    ]);
    if(mine.error||received.error||prep.error)return setMsg(mine.error?.message??received.error?.message??prep.error?.message??"Impossible de charger les ordonnances.");
    setInternal((mine.data??[]) as Ord[]);setIncoming((received.data??[]) as Ord[]);
    setPreparations(Object.fromEntries(((prep.data??[]) as Preparation[]).map(x=>[x.prescription_id,x])));
    const {data:consultationRows,error:consultationError}=await sb.from("consultations_pharmaceutiques").select("id,client_id,patient_nom,motif,created_by,created_at,conclusion").eq("pharmacie_id",id).order("created_at",{ascending:false}).limit(100);
    if(!consultationError)setConsultations((consultationRows??[]) as Consultation[]);
    const {data:audit,error:auditLoadError}=await sb.from("pharmacien_audit_events").select("id,actor_user_id,entity_type,entity_id,action,old_status,new_status,reason,occurred_at,metadata").eq("pharmacie_id",id).order("occurred_at",{ascending:false}).limit(200);
    if(auditLoadError){setAuditEvents([]);setAuditError("Le journal append-only attend la migration 190 ou ses droits RLS ne sont pas encore disponibles.");}
    else{setAuditEvents((audit??[]) as AuditEvent[]);setAuditError("");}
  }

  useEffect(()=>{(async()=>{
    const {data:u}=await sb.auth.getUser();if(!u.user)return setMsg("Connexion requise.");
    const {data:p}=await sb.from("profiles").select("fonction_interne,pharmacie_id,actif,first_name,last_name,phone,username").eq("id",u.user.id).single();
    if(!p?.pharmacie_id||p.actif!==true||p.fonction_interne!=="pharmacien")return setMsg("Accès réservé à un compte Pharmacien actif.");
    setProfileInfo({first_name:p.first_name??null,last_name:p.last_name??null,phone:p.phone??null,username:p.username??null,email:u.user.email??""});
    setPid(p.pharmacie_id);charger(p.pharmacie_id);
  })()},[sb]);

  useEffect(()=>{
    try{const savedSize=window.localStorage.getItem("naxa-pharmacien-text-size");const savedCompact=window.localStorage.getItem("naxa-pharmacien-compact");if(savedSize==="grand")setTextSize("grand");setCompactDisplay(savedCompact==="true");}
    catch{/* Préférences conservées en mémoire si le stockage est indisponible. */}
    finally{setPreferencesReady(true);}
  },[]);

  async function saveProfilePreferences(){
    try{window.localStorage.setItem("naxa-pharmacien-text-size",textSize);window.localStorage.setItem("naxa-pharmacien-compact",String(compactDisplay));setMsg("Préférences d’affichage enregistrées sur cet appareil.");}
    catch{setMsg("Le navigateur ne permet pas d’enregistrer les préférences sur cet appareil.");}
  }

  async function changePassword(){
    if(newPassword.length<10||newPassword!==confirmPassword){setMsg("Le mot de passe doit contenir au moins 10 caractères et les deux saisies doivent être identiques.");return;}
    setPasswordBusy(true);setMsg("");const {error}=await sb.auth.updateUser({password:newPassword});setPasswordBusy(false);
    if(error){setMsg(error.message||"Le changement de mot de passe a échoué.");return;}
    setNewPassword("");setConfirmPassword("");setMsg("Mot de passe mis à jour par le service d’authentification.");
  }

  async function creerConsultation(){
    if(!pid)return;
    if(!consult.patient.trim()||!consult.motif.trim()){setMsg("Le nom du patient et le motif sont obligatoires.");return;}
    setBusy(true);
    const {data,error}=await sb.rpc("pharmacien_creer_consultation",{p_pharmacie:pid,p_patient_nom:consult.patient,p_motif:consult.motif,p_client_id:consult.clientId.trim()||null,p_observations:consult.observations,p_conclusion:consult.conclusion,p_recommandations:consult.recommandations});
    setBusy(false);if(error)return setMsg(error.message);
    setPresc(x=>({...x,patient:consult.patient,clientId:consult.clientId,consultationId:data}));setMsg("Consultation enregistrée.");setTab("prescription");
  }

  async function creerPrescription(){
    if(!pid)return;
    if(!presc.patient.trim()||!presc.designation.trim()||!Number.isInteger(Number(presc.quantite))||Number(presc.quantite)<1){setMsg("Renseignez le patient, la désignation et une quantité entière positive.");return;}
    setBusy(true);
    const {data,error}=await sb.rpc("pharmacien_creer_prescription",{p_pharmacie:pid,p_patient_nom:presc.patient,p_client_id:presc.clientId.trim()||null,p_consultation_id:presc.consultationId.trim()||null,p_designation:presc.designation,p_quantite:Number(presc.quantite),p_posologie:presc.posologie,p_duree:presc.duree,p_instructions:presc.instructions,p_commentaire:presc.commentaire});
    setBusy(false);if(error)return setMsg(error.message);
    setMsg("Prescription émise et enregistrée.");setPresc(x=>({...x,designation:"",quantite:"1",posologie:"",duree:"",instructions:"",commentaire:""}));if(pid)charger(pid);setTab("ordonnances");
  }

  async function demanderComplement(id:string){
    const {error}=await sb.rpc("pharmacien_demander_complement",{p_prescription:id,p_motif:motif[id]??""});
    setMsg(error?error.message:"Complément demandé à l’équipe Pharmacien.");if(!error&&pid)charger(pid);
  }

  async function decider(id:string,ok:boolean){
    if(!ok&&!(motif[id]??"").trim()){setMsg("Un motif est obligatoire pour rejeter une ordonnance.");return;}
    setBusy(true);
    const {error}=await sb.rpc("prescription_valider",{p_prescription:id,p_accepter:ok,p_motif:motif[id]??null});
    setBusy(false);
    setMsg(error?error.message:(ok?"Ordonnance validée.":"Ordonnance rejetée."));if(!error&&pid)charger(pid);
  }

  async function soumettrePreparation(id:string){
    setBusy(true);
    const {error}=await sb.rpc("pharmacien_soumettre_preparation",{p_prescription:id,p_notes:notesPreparation[id]??preparations[id]?.notes_preparation??""});
    setBusy(false);
    setMsg(error?error.message:"Préparation enregistrée dans le dossier. La décision reste traçable.");if(!error&&pid)charger(pid);
  }

  const historyRows=[...incoming.map(r=>({...r,origine:"Ordonnance reçue"})),...internal.map(r=>({...r,origine:"Prescription interne"}))].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
  const historyFiltered=historyRows.filter(r=>{
    const q=historySearch.trim().toLowerCase();
    const matchText=!q||r.id.toLowerCase().includes(q)||r.statut.toLowerCase().includes(q)||r.origine.toLowerCase().includes(q);
    const matchType=historyType==="toutes"||(historyType==="reçues"&&r.origine==="Ordonnance reçue")||(historyType==="internes"&&r.origine==="Prescription interne");
    const date=r.created_at.slice(0,10);
    return matchText&&matchType&&(!historyFrom||date>=historyFrom)&&(!historyTo||date<=historyTo);
  });
  const auditFiltered=auditEvents.filter(e=>{
    const q=historySearch.trim().toLowerCase();
    const matchText=!q||e.entity_id.toLowerCase().includes(q)||e.entity_type.includes(q)||e.action.includes(q)||(e.new_status??"").includes(q)||(e.reason??"").toLowerCase().includes(q);
    const matchType=historyType==="toutes"||(historyType==="consultations"&&e.entity_type==="consultation")||(historyType==="décisions"&&e.entity_type==="prescription")||(historyType==="préparations"&&e.entity_type==="preparation");
    const date=e.occurred_at.slice(0,10);
    return matchText&&matchType&&(!historyFrom||date>=historyFrom)&&(!historyTo||date<=historyTo);
  });
  const auditActionLabel=(action:string)=>({created:"Création",status_changed:"Changement de statut",complement_requested:"Complément demandé",preparation_updated:"Préparation mise à jour",updated:"Mise à jour"}[action]??action);
  const reportSince=reportPeriod==="jour"?new Date(new Date().setHours(0,0,0,0)):reportPeriod==="7jours"?new Date(Date.now()-7*86400000):reportPeriod==="30jours"?new Date(Date.now()-30*86400000):null;
  const reportIncoming=incoming.filter(r=>!reportSince||new Date(r.created_at)>=reportSince);
  const reportInternal=internal.filter(r=>!reportSince||new Date(r.created_at)>=reportSince);
  const reportAuditEvents=auditEvents.filter(e=>!reportSince||new Date(e.occurred_at)>=reportSince);
  async function exportReport(){
    if(!pid){setMsg("Pharmacie non chargée : export bloqué.");return;}
    setBusy(true);setMsg("");
    const {error}=await sb.rpc("pharmacien_journaliser_export",{p_period:reportPeriod,p_row_count:reportAuditEvents.length});
    setBusy(false);
    if(error){setMsg("Export bloqué : la journalisation serveur est indisponible. Vérifiez la migration 191 et les droits du compte.");return;}
    const rows=[["Date","Type","Action","Référence dossier","Statut précédent","Statut actuel"],...reportAuditEvents.map(e=>[new Date(e.occurred_at).toISOString(),e.entity_type,e.action,e.entity_id.slice(0,8).toUpperCase(),e.old_status??"",e.new_status??""])];
    const csv="\\uFEFF"+rows.map(row=>row.map(value=>`"${String(value??"").replace(/"/g,'""')}"`).join(";")).join("\\r\\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`naxa-rapport-pharmacien-${reportPeriod}-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    setMsg(`Export CSV généré (${reportAuditEvents.length} événements) et journalisé côté serveur.`);
  }

  return <PharmacienWorkspaceShell activeTab={tab} onNavigate={setTab}>
    <div className={`${textSize==="grand"?"text-lg":""} ${compactDisplay?"space-y-2 [&_.carte]:p-3":"space-y-4"}`}>
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-naxa-green-900 px-4 py-3 text-white"><a href="/pharmacie">← Pharmacie</a><b>Espace Pharmacien</b></header>
    {msg&&<p role="status" className="my-3 carte">{msg}</p>}
    <section className="carte mb-4">
      <h1 className="text-xl font-extrabold">Espace opérationnel Pharmacien</h1>
      <p className="mt-1 text-sm">Un seul poste Pharmacien : consultation, prescription, préparation et décision sur les ordonnances dans une interface commune.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={tab==="consultation"?"btn btn-vert":"btn btn-clair"} onClick={()=>setTab("consultation")}>Consultation</button>
        <button className={tab==="prescription"?"btn btn-vert":"btn btn-clair"} onClick={()=>setTab("prescription")}>Prescription</button>
        <button className={tab==="ordonnances"?"btn btn-vert":"btn btn-clair"} onClick={()=>setTab("ordonnances")}>Ordonnances ({incoming.length})</button><button className={tab==="preparations"?"btn btn-vert":"btn btn-clair"} onClick={()=>setTab("preparations")}>Préparations</button>
      </div>
    </section>

    {tab==="dashboard"&&<section className="carte"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Tableau de bord</h2><button type="button" disabled={busy||!pid} className="btn btn-clair" onClick={()=>{if(pid)void charger(pid)}}>Actualiser les données</button></div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Ordonnances en attente</p><p className="text-2xl font-extrabold">{incoming.length}</p><button type="button" className="mt-2 text-sm font-bold underline" onClick={()=>setTab("ordonnances")}>Examiner les dossiers</button></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Préparations enregistrées</p><p className="text-2xl font-extrabold">{Object.keys(preparations).length}</p><button type="button" className="mt-2 text-sm font-bold underline" onClick={()=>setTab("preparations")}>Ouvrir les préparations</button></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Prescriptions internes récentes</p><p className="text-2xl font-extrabold">{internal.length}</p><button type="button" className="mt-2 text-sm font-bold underline" onClick={()=>setTab("prescription")}>Créer une prescription</button></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Consultations chargées</p><p className="text-2xl font-extrabold">{consultations.length}</p><button type="button" className="mt-2 text-sm font-bold underline" onClick={()=>setTab("consultation")}>Voir les consultations</button></div></div><p className="mt-3 text-sm text-slate-600">Les compteurs représentent les données chargées par le poste, pas l’ensemble de l’historique pharmaceutique.</p></section>}

    {tab==="dispositifs"&&<section className="carte space-y-3"><h2 className="text-lg font-bold">Suivi des dispositifs Patient</h2><p className="text-sm text-slate-600">Cette rubrique est maintenant isolée dans le parcours Pharmacien. Elle n’affiche pas encore de données patient : le suivi partagé exige un consentement explicite et révocable, des droits RLS dédiés et une liaison vérifiée aux mesures et prescriptions.</p><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>Module non connecté aux dossiers patients.</b><p className="mt-1">Aucune donnée médicale ne sera affichée à partir du tableau personnel /suivi. Les alertes, l’historique des accès et le suivi des prescriptions doivent être raccordés et testés avant mise en service.</p></div></section>}

    {tab==="consultation"&&<div className="space-y-4"><section className="carte space-y-3">
      <h2 className="text-lg font-bold">Nouvelle consultation pharmaceutique</h2>
      <label className="block text-sm font-semibold">Nom du patient<input className="champ mt-1 w-full" value={consult.patient} onChange={e=>setConsult(x=>({...x,patient:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">ID client NAXA (facultatif)<input className="champ mt-1 w-full" value={consult.clientId} onChange={e=>setConsult(x=>({...x,clientId:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Motif<input className="champ mt-1 w-full" value={consult.motif} onChange={e=>setConsult(x=>({...x,motif:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Observations<textarea className="champ mt-1 min-h-24 w-full" value={consult.observations} onChange={e=>setConsult(x=>({...x,observations:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Conclusion<textarea className="champ mt-1 min-h-20 w-full" value={consult.conclusion} onChange={e=>setConsult(x=>({...x,conclusion:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Recommandations<textarea className="champ mt-1 min-h-20 w-full" value={consult.recommandations} onChange={e=>setConsult(x=>({...x,recommandations:e.target.value}))}/></label>
      <button disabled={busy} className="btn btn-vert w-full" onClick={creerConsultation}>{busy?"Enregistrement…":"Enregistrer la consultation et passer à la prescription"}</button>
    </section><section className="carte space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Consultations récentes</h2><span className="text-sm text-slate-500">{consultations.length} dossier(s) chargé(s)</span></div><label className="block text-sm font-semibold">Rechercher par patient, motif ou référence<input className="champ mt-1 w-full" value={consultSearch} onChange={e=>setConsultSearch(e.target.value)} placeholder="Nom, motif, identifiant"/></label>{consultations.filter(item=>{const q=consultSearch.trim().toLowerCase();return !q||item.patient_nom.toLowerCase().includes(q)||item.motif.toLowerCase().includes(q)||item.id.toLowerCase().includes(q)}).map(item=><article key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><b>{item.patient_nom}</b><p className="text-sm text-slate-600">{new Date(item.created_at).toLocaleString("fr-FR")} · {item.motif}</p><p className="text-xs text-slate-500">Dossier {item.id.slice(0,8).toUpperCase()}</p></div><button type="button" className="btn btn-clair" onClick={()=>{setPresc(x=>({...x,patient:item.patient_nom,clientId:item.client_id??"",consultationId:item.id}));setTab("prescription");}}>Créer une prescription liée</button></div>{item.conclusion&&<p className="mt-2 text-sm">Conclusion enregistrée : {item.conclusion}</p>}</article>)}{consultations.length===0&&<p className="text-sm text-slate-600">Aucune consultation enregistrée ou liste non accessible.</p>}</section></div>}

    {tab==="prescription"&&<section className="carte space-y-3">
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

    {tab==="ordonnances"&&<div className="space-y-4">
      <section className="carte"><h2 className="text-lg font-bold">Ordonnances reçues à contrôler</h2>{incoming.length===0&&<p className="my-3 text-sm">Aucune ordonnance en attente.</p>}
        {incoming.map(r=><article key={r.id} className="carte my-3 space-y-3"><div><b>Ordonnance {r.id.slice(0,8).toUpperCase()}</b><p className="text-sm">{new Date(r.created_at).toLocaleString("fr-FR")}</p>{r.document_ref&&<p className="text-sm">Document : {r.document_ref}</p>}{preparations[r.id]&&<div className="rounded-lg bg-slate-50 p-3 text-sm"><b>Préparation · {preparations[r.id].statut}</b>{preparations[r.id].notes_preparation&&<p className="mt-1">{preparations[r.id].notes_preparation}</p>}{preparations[r.id].motif_complement&&<p className="mt-1 text-amber-800">Complément demandé : {preparations[r.id].motif_complement}</p>}</div>}</div><textarea className="champ min-h-20 w-full" placeholder="Motif de rejet ou complément demandé" value={motif[r.id]??""} onChange={e=>setMotif(x=>({...x,[r.id]:e.target.value}))}/><div className="flex flex-wrap gap-2"><button className="btn btn-vert" onClick={()=>decider(r.id,true)}>Valider</button><button className="btn btn-clair" onClick={()=>decider(r.id,false)}>Rejeter</button><button className="btn btn-canari" disabled={!preparations[r.id]||!motif[r.id]?.trim()} onClick={()=>demanderComplement(r.id)}>Demander un complément</button></div></article>)}
      </section>
      <section className="carte"><h2 className="text-lg font-bold">Prescriptions émises par la pharmacie</h2>{internal.length===0&&<p className="my-3 text-sm">Aucune prescription interne récente.</p>}{internal.map(r=><article key={r.id} className="carte my-3"><b>Prescription {r.id.slice(0,8).toUpperCase()}</b><p className="text-sm">{new Date(r.created_at).toLocaleString("fr-FR")} · {r.statut}</p>{r.consultation_id&&<p className="text-sm">Consultation liée : {r.consultation_id.slice(0,8).toUpperCase()}</p>}</article>)}</section>
    </div>}

    {tab==="preparations"&&<section className="carte space-y-4"><h2 className="text-lg font-bold">Préparation des ordonnances</h2><p className="text-sm text-slate-600">Le même poste Pharmacien peut noter les éléments préparatoires puis prendre la décision dans l’onglet Ordonnances. La note ne change pas le statut pharmaceutique.</p>{incoming.length===0&&<p className="text-sm">Aucune ordonnance en attente de préparation.</p>}{incoming.map(r=><article key={r.id} className="rounded-xl border border-slate-200 p-3 space-y-3"><div><b>Ordonnance {r.id.slice(0,8).toUpperCase()}</b><p className="text-sm text-slate-600">{new Date(r.created_at).toLocaleString("fr-FR")}</p></div><textarea className="champ min-h-24 w-full" placeholder="Notes de préparation, pièces manquantes ou vérifications à tracer" value={notesPreparation[r.id]??preparations[r.id]?.notes_preparation??""} onChange={e=>setNotesPreparation(x=>({...x,[r.id]:e.target.value}))}/><button className="btn btn-vert" onClick={()=>soumettrePreparation(r.id)}>Enregistrer la préparation</button></article>)}</section>}


    {tab==="historique"&&<section className="carte space-y-4"><h2 className="text-lg font-bold">Historique opérationnel</h2><p className="text-sm text-slate-600">Recherche dans les dossiers actuellement accessibles au compte. Les filtres fonctionnent sur les enregistrements chargés ; ce n’est pas encore un journal serveur exhaustif des clics, auteurs et modifications.</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="block text-sm font-semibold">Recherche<input className="champ mt-1 w-full" value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="Référence, statut, type"/></label><label className="block text-sm font-semibold">Type<select className="champ mt-1 w-full" value={historyType} onChange={e=>setHistoryType(e.target.value)}><option value="toutes">Tous les types</option><option value="consultations">Événements de consultation</option><option value="décisions">Prescriptions et décisions</option><option value="préparations">Événements de préparation</option><option value="reçues">Ordonnances reçues (liste active)</option><option value="internes">Prescriptions internes (liste chargée)</option></select></label><label className="block text-sm font-semibold">Depuis<input className="champ mt-1 w-full" type="date" value={historyFrom} onChange={e=>setHistoryFrom(e.target.value)}/></label><label className="block text-sm font-semibold">Jusqu’au<input className="champ mt-1 w-full" type="date" value={historyTo} onChange={e=>setHistoryTo(e.target.value)}/></label></div><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-slate-600">{auditFiltered.length+historyFiltered.length} opération(s) visibles dans les deux sources</span><button type="button" className="btn btn-clair" onClick={()=>{setHistorySearch("");setHistoryType("toutes");setHistoryFrom("");setHistoryTo("");}}>Réinitialiser les filtres</button></div>{auditError&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{auditError}</p>}<h3 className="font-bold">Journal d’audit serveur</h3>{auditFiltered.length===0?<p className="text-sm text-slate-600">Aucun événement d’audit pour ces filtres ou journal non encore disponible.</p>:auditFiltered.slice(0,100).map(e=><article key={e.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><b>{e.entity_type==="consultation"?"Consultation":e.entity_type==="preparation"?"Préparation":"Prescription"} · {auditActionLabel(e.action)}</b><span className="text-sm text-slate-600">{new Date(e.occurred_at).toLocaleString("fr-FR")}</span></div><p className="mt-1 text-sm">Dossier : {e.entity_id.slice(0,8).toUpperCase()} · {e.old_status??"—"} → {e.new_status??"—"}</p>{e.reason&&<p className="mt-1 text-sm">Motif enregistré : {e.reason}</p>}<p className="mt-1 text-xs text-slate-500">Auteur : {e.actor_user_id?e.actor_user_id.slice(0,8).toUpperCase():"système"}</p></article>)}<h3 className="mt-4 font-bold">Dossiers récents chargés (vue de secours)</h3>{historyFiltered.length===0?<p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm">Aucune opération ne correspond à la recherche.</p>:historyFiltered.slice(0,100).map(r=><article key={r.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><b>{r.origine} · {r.id.slice(0,8).toUpperCase()}</b><span className="text-sm text-slate-600">{new Date(r.created_at).toLocaleString("fr-FR")}</span></div><p className="mt-1 text-sm">Statut disponible : {r.statut}</p></article>)}<p className="text-xs text-amber-800">Limite actuelle : au plus 100 dossiers affichés parmi les enregistrements chargés. Le journal append-only couvre les créations et mises à jour des consultations, prescriptions et préparations ; il ne couvre pas encore les clics de navigation ni les exports.</p></section>}
    {tab==="rapports"&&<section className="carte space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Rapports et Performances</h2><p className="text-sm text-slate-600">Indicateurs calculés sur les dossiers chargés ; ils ne représentent pas encore un historique exhaustif.</p></div><label className="block text-sm font-semibold">Période<select className="champ mt-1" value={reportPeriod} onChange={e=>setReportPeriod(e.target.value as typeof reportPeriod)}><option value="jour">Aujourd’hui</option><option value="7jours">7 derniers jours</option><option value="30jours">30 derniers jours</option><option value="tout">Tout ce qui est chargé</option></select></label></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Ordonnances reçues en attente dans la période</p><p className="text-2xl font-extrabold">{reportIncoming.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Prescriptions internes chargées dans la période</p><p className="text-2xl font-extrabold">{reportInternal.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Préparations actuellement chargées</p><p className="text-2xl font-extrabold">{Object.keys(preparations).length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Compléments visibles parmi les ordonnances en attente</p><p className="text-2xl font-extrabold">{reportIncoming.filter(r=>Boolean(preparations[r.id]?.motif_complement)).length}</p></div></div><h3 className="font-bold">Activité d’audit dans la période sélectionnée</h3><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Consultations créées</p><p className="text-2xl font-extrabold">{reportAuditEvents.filter(e=>e.entity_type==="consultation"&&e.action==="created").length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Événements prescription</p><p className="text-2xl font-extrabold">{reportAuditEvents.filter(e=>e.entity_type==="prescription").length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Événements préparation</p><p className="text-2xl font-extrabold">{reportAuditEvents.filter(e=>e.entity_type==="preparation").length}</p></div></div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Basé sur les {auditEvents.length} événements d’audit les plus récents chargés (maximum 200).</p><button type="button" disabled={busy} onClick={()=>void exportReport()} className="btn btn-vert disabled:opacity-50">{busy?"Journalisation…":"Exporter le rapport CSV (journalisé)"}</button></div><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Les délais médian, comparaisons complètes, motifs historiques exhaustifs, disponibilité du stock et réservations Marketplace nécessitent des agrégats serveur consolidés. Le CSV ne contient aucun nom de patient et l’export est enregistré dans le journal serveur.</p></section>}

    {tab==="profil"&&<section className="carte space-y-4"><div><h2 className="text-lg font-bold">Profil professionnel</h2><p className="text-sm text-slate-600">Compte, sécurité, préférences et activité récente du poste Pharmacien.</p></div><div className="flex flex-wrap gap-2" role="tablist" aria-label="Onglets du profil Pharmacien">{([{id:"compte",label:"Compte"},{id:"securite",label:"Sécurité"},{id:"preferences",label:"Préférences"},{id:"activite",label:"Activité"}] as const).map(item=><button key={item.id} type="button" role="tab" aria-selected={profileTab===item.id} onClick={()=>setProfileTab(item.id)} className={`min-h-10 rounded-xl px-4 py-2 text-sm font-bold ${profileTab===item.id?"bg-[#0B3D26] text-white":"bg-slate-100 text-slate-700"}`}>{item.label}</button>)}</div>{profileTab==="compte"&&<dl className="grid gap-3 sm:grid-cols-2 text-sm"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">Nom affiché</dt><dd className="font-semibold">{[profileInfo.first_name,profileInfo.last_name].filter(Boolean).join(" ")||profileInfo.username||"Non renseigné"}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">E-mail de connexion</dt><dd className="break-all font-semibold">{profileInfo.email||"Non renseigné"}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">Téléphone</dt><dd className="font-semibold">{profileInfo.phone||"Non renseigné"}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">Fonction</dt><dd className="font-semibold">Pharmacien actif · pharmacie rattachée</dd></div></dl>}{profileTab==="securite"&&<div className="space-y-3"><p className="text-sm text-slate-600">Le mot de passe est modifié par Supabase Auth ; NAXA ne stocke pas le mot de passe en clair.</p><label className="block text-sm font-semibold">Nouveau mot de passe<input className="champ mt-1 w-full" type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><label className="block text-sm font-semibold">Confirmer le mot de passe<input className="champ mt-1 w-full" type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><button type="button" disabled={passwordBusy} onClick={()=>void changePassword()} className="btn btn-vert disabled:opacity-50">{passwordBusy?"Mise à jour…":"Modifier le mot de passe"}</button></div>}{profileTab==="preferences"&&<div className="space-y-4"><label className="block text-sm font-semibold">Taille du texte<select className="champ mt-1 w-full" value={textSize} onChange={e=>setTextSize(e.target.value as "normal"|"grand")}><option value="normal">Normale</option><option value="grand">Grande</option></select></label><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={compactDisplay} onChange={e=>setCompactDisplay(e.target.checked)}/> Affichage compact</label><button type="button" disabled={!preferencesReady} onClick={()=>void saveProfilePreferences()} className="btn btn-vert disabled:opacity-50">Enregistrer les préférences sur cet appareil</button><p className="text-xs text-slate-500">Les préférences sont locales à cet appareil et ne modifient pas les données de santé.</p></div>}{profileTab==="activite"&&<div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Ordonnances en attente</p><p className="text-2xl font-black">{incoming.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Prescriptions internes chargées</p><p className="text-2xl font-black">{internal.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Événements d’audit chargés</p><p className="text-2xl font-black">{auditEvents.length}</p></div><button type="button" className="btn btn-clair sm:col-span-3" onClick={()=>setTab("historique")}>Ouvrir l’historique opérationnel</button></div>}</section>}
    </div>
  </PharmacienWorkspaceShell>;
}
