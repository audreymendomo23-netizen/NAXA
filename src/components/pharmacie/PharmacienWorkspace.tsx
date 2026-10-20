"use client";

import { useEffect, useMemo, useState } from "react";
import { PharmacienWorkspaceShell } from "@/components/pharmacie/PharmacienWorkspaceShell";
import { supabaseBrowser } from "@/lib/supabase/client";

type Ord={id:string;document_ref:string|null;created_at:string;motif_rejet:string|null;client_id:string|null;statut:string;consultation_id?:string|null};
type Preparation={prescription_id:string;statut:string;notes_preparation:string|null;motif_complement:string|null;updated_at:string};

export function PharmacienWorkspace({ initialTab = "dashboard" }: { initialTab?: "dashboard" | "consultation" | "prescription" | "ordonnances" | "preparations" | "dispositifs" | "historique" | "rapports" | "profil" }) {
  const sb=useMemo(() => supabaseBrowser(), []);
  const [pid,setPid]=useState<string|null>(null),[tab,setTab]=useState<"dashboard"|"consultation"|"prescription"|"ordonnances"|"preparations"|"dispositifs"|"historique"|"rapports"|"profil">(initialTab);
  const [internal,setInternal]=useState<Ord[]>([]),[incoming,setIncoming]=useState<Ord[]>([]),[preparations,setPreparations]=useState<Record<string,Preparation>>({});
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
  }

  useEffect(()=>{(async()=>{
    const {data:u}=await sb.auth.getUser();if(!u.user)return setMsg("Connexion requise.");
    const {data:p}=await sb.from("profiles").select("fonction_interne,pharmacie_id,actif").eq("id",u.user.id).single();
    if(!p?.pharmacie_id||p.actif!==true||p.fonction_interne!=="pharmacien")return setMsg("Accès réservé à un compte Pharmacien actif.");
    setPid(p.pharmacie_id);charger(p.pharmacie_id);
  })()},[sb]);

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
  const reportSince=reportPeriod==="jour"?new Date(new Date().setHours(0,0,0,0)):reportPeriod==="7jours"?new Date(Date.now()-7*86400000):reportPeriod==="30jours"?new Date(Date.now()-30*86400000):null;
  const reportIncoming=incoming.filter(r=>!reportSince||new Date(r.created_at)>=reportSince);
  const reportInternal=internal.filter(r=>!reportSince||new Date(r.created_at)>=reportSince);

  return <PharmacienWorkspaceShell activeTab={tab} onNavigate={setTab}>
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

    {tab==="dashboard"&&<section className="carte"><h2 className="text-lg font-bold">Tableau de bord</h2><div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Ordonnances en attente</p><p className="text-2xl font-extrabold">{incoming.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Préparations enregistrées</p><p className="text-2xl font-extrabold">{Object.keys(preparations).length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Prescriptions internes récentes</p><p className="text-2xl font-extrabold">{internal.length}</p></div></div><p className="mt-3 text-sm text-slate-600">Choisissez une entrée du menu pour ouvrir les opérations correspondantes. Les décisions pharmaceutiques restent enregistrées via les RPC dédiées.</p></section>}

    {tab==="dispositifs"&&<section className="carte space-y-3"><h2 className="text-lg font-bold">Suivi des dispositifs Patient</h2><p className="text-sm text-slate-600">Cette rubrique est maintenant isolée dans le parcours Pharmacien. Elle n’affiche pas encore de données patient : le suivi partagé exige un consentement explicite et révocable, des droits RLS dédiés et une liaison vérifiée aux mesures et prescriptions.</p><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>Module non connecté aux dossiers patients.</b><p className="mt-1">Aucune donnée médicale ne sera affichée à partir du tableau personnel /suivi. Les alertes, l’historique des accès et le suivi des prescriptions doivent être raccordés et testés avant mise en service.</p></div></section>}

    {tab==="consultation"&&<section className="carte space-y-3">
      <h2 className="text-lg font-bold">Nouvelle consultation pharmaceutique</h2>
      <label className="block text-sm font-semibold">Nom du patient<input className="champ mt-1 w-full" value={consult.patient} onChange={e=>setConsult(x=>({...x,patient:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">ID client NAXA (facultatif)<input className="champ mt-1 w-full" value={consult.clientId} onChange={e=>setConsult(x=>({...x,clientId:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Motif<input className="champ mt-1 w-full" value={consult.motif} onChange={e=>setConsult(x=>({...x,motif:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Observations<textarea className="champ mt-1 min-h-24 w-full" value={consult.observations} onChange={e=>setConsult(x=>({...x,observations:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Conclusion<textarea className="champ mt-1 min-h-20 w-full" value={consult.conclusion} onChange={e=>setConsult(x=>({...x,conclusion:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Recommandations<textarea className="champ mt-1 min-h-20 w-full" value={consult.recommandations} onChange={e=>setConsult(x=>({...x,recommandations:e.target.value}))}/></label>
      <button disabled={busy} className="btn btn-vert w-full" onClick={creerConsultation}>{busy?"Enregistrement…":"Enregistrer la consultation et passer à la prescription"}</button>
    </section>}

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


    {tab==="historique"&&<section className="carte space-y-4"><h2 className="text-lg font-bold">Historique opérationnel</h2><p className="text-sm text-slate-600">Recherche dans les dossiers actuellement accessibles au compte. Les filtres fonctionnent sur les enregistrements chargés ; ce n’est pas encore un journal serveur exhaustif des clics, auteurs et modifications.</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="block text-sm font-semibold">Recherche<input className="champ mt-1 w-full" value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="Référence, statut, type"/></label><label className="block text-sm font-semibold">Type<select className="champ mt-1 w-full" value={historyType} onChange={e=>setHistoryType(e.target.value)}><option value="toutes">Tous les types</option><option value="reçues">Ordonnances reçues</option><option value="internes">Prescriptions internes</option></select></label><label className="block text-sm font-semibold">Depuis<input className="champ mt-1 w-full" type="date" value={historyFrom} onChange={e=>setHistoryFrom(e.target.value)}/></label><label className="block text-sm font-semibold">Jusqu’au<input className="champ mt-1 w-full" type="date" value={historyTo} onChange={e=>setHistoryTo(e.target.value)}/></label></div><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-slate-600">{historyFiltered.length} opération(s) correspondant aux filtres</span><button type="button" className="btn btn-clair" onClick={()=>{setHistorySearch("");setHistoryType("toutes");setHistoryFrom("");setHistoryTo("");}}>Réinitialiser les filtres</button></div>{historyFiltered.length===0?<p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm">Aucune opération ne correspond à la recherche.</p>:historyFiltered.slice(0,100).map(r=><article key={r.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><b>{r.origine} · {r.id.slice(0,8).toUpperCase()}</b><span className="text-sm text-slate-600">{new Date(r.created_at).toLocaleString("fr-FR")}</span></div><p className="mt-1 text-sm">Statut disponible : {r.statut}</p></article>)}<p className="text-xs text-amber-800">Limite actuelle : au plus 100 dossiers affichés parmi les enregistrements déjà chargés. Les événements d’audit append-only restent à intégrer pour reconstituer toute la chaîne d’actions.</p></section>}
    {tab==="rapports"&&<section className="carte space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Rapports et Performances</h2><p className="text-sm text-slate-600">Indicateurs calculés sur les dossiers chargés ; ils ne représentent pas encore un historique exhaustif.</p></div><label className="block text-sm font-semibold">Période<select className="champ mt-1" value={reportPeriod} onChange={e=>setReportPeriod(e.target.value as typeof reportPeriod)}><option value="jour">Aujourd’hui</option><option value="7jours">7 derniers jours</option><option value="30jours">30 derniers jours</option><option value="tout">Tout ce qui est chargé</option></select></label></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Ordonnances reçues en attente dans la période</p><p className="text-2xl font-extrabold">{reportIncoming.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Prescriptions internes chargées dans la période</p><p className="text-2xl font-extrabold">{reportInternal.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Préparations actuellement chargées</p><p className="text-2xl font-extrabold">{Object.keys(preparations).length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Compléments visibles parmi les ordonnances en attente</p><p className="text-2xl font-extrabold">{reportIncoming.filter(r=>Boolean(preparations[r.id]?.motif_complement)).length}</p></div></div><h3 className="font-bold">Indicateurs disponibles maintenant</h3><ul className="list-disc space-y-1 pl-5 text-sm"><li>Volume de dossiers reçus encore en attente.</li><li>Volume de prescriptions internes présentes dans l’échantillon chargé.</li><li>Préparations et demandes de complément visibles dans les données chargées.</li></ul><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Le délai médian, les motifs historiques de rejet, les tendances comparatives, la disponibilité du stock, les réservations Marketplace et l’export traçable nécessitent des sources serveur consolidées et un journal d’audit. Aucun indicateur non vérifié n’est calculé ici.</p></section>}

    {tab==="profil"&&<section className="carte"><h2 className="text-lg font-bold">Profil professionnel</h2><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-slate-500">Poste</dt><dd className="font-semibold">Pharmacien</dd></div><div><dt className="text-slate-500">Périmètre</dt><dd className="font-semibold">Pharmacie rattachée au compte actif</dd></div><div><dt className="text-slate-500">Droits</dt><dd>Consultation, prescription, préparation, validation/rejet et demande de complément selon le contrôle serveur.</dd></div></dl></section>}
</PharmacienWorkspaceShell>;
}
