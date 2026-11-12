"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type CaseRow={id:string;patient_user_id:string;professional_user_id:string;initial_diagnosis:string;monitoring_reason:string|null;status:"active"|"paused"|"closed";created_at:string;updated_at:string};
type Entry={id:string;entry_type:"diagnosis"|"observation"|"follow_up"|"measurement";content:string;created_at:string;professional_user_id:string;measurement_id?:string|null};
type LinkRow={id:string;active:boolean;clinical_notes_access:boolean;revoked_at:string|null};
export function SuiviClinicalCasePanel({patientId,professionalId}:{patientId:string;professionalId:string}){
  const sb=useMemo(()=>supabaseBrowser(),[]);
  const [loading,setLoading]=useState(true);
  const [allowed,setAllowed]=useState(false);
  const [caseRow,setCaseRow]=useState<CaseRow|null>(null);
  const [entries,setEntries]=useState<Entry[]>([]);
  const [diagnosis,setDiagnosis]=useState("");
  const [reason,setReason]=useState("");
  const [note,setNote]=useState("");
  const [kind,setKind]=useState<"diagnosis"|"observation"|"follow_up">("observation");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setNotice("");
    const {data:link,error:linkError}=await sb.from("suivi_care_links")
      .select("id,active,clinical_notes_access,revoked_at")
      .eq("patient_user_id",patientId).eq("professional_user_id",professionalId)
      .eq("active",true).is("revoked_at",null).maybeSingle();
    if(linkError||!link?.clinical_notes_access){setAllowed(false);setCaseRow(null);setEntries([]);setLoading(false);return;}
    setAllowed(true);
    const {data:row,error:caseError}=await sb.from("suivi_patient_cases")
      .select("id,patient_user_id,professional_user_id,initial_diagnosis,monitoring_reason,status,created_at,updated_at")
      .eq("patient_user_id",patientId).eq("professional_user_id",professionalId).maybeSingle();
    if(caseError){setNotice("Le dossier clinique n'est pas accessible. Vérifiez les migrations et les droits RLS.");setLoading(false);return;}
    setCaseRow(row as CaseRow|null);
    if(row){
      setDiagnosis(row.initial_diagnosis);setReason(row.monitoring_reason??"");
      const {data:history,error:historyError}=await sb.from("suivi_clinical_entries")
        .select("id,entry_type,content,created_at,professional_user_id")
        .eq("case_id",row.id).order("created_at",{ascending:false}).limit(200);
      if(historyError) setNotice("Le dossier est présent, mais son historique clinique n'a pas pu être chargé.");
      else setEntries((history??[]) as Entry[]);
    }else{setEntries([]);setDiagnosis("");setReason("");}
    setLoading(false);
  },[sb,patientId,professionalId]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    const channel=sb.channel("suivi-dossier-"+patientId+"-"+professionalId)
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_care_links"},()=>{void load();})
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_patient_cases"},()=>{void load();})
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_clinical_entries"},()=>{void load();})
      .subscribe();
    return ()=>{void sb.removeChannel(channel);};
  },[sb,patientId,professionalId,load]);

  async function createCase(){
    if(diagnosis.trim().length<3){setNotice("Le diagnostic ou motif initial doit contenir au moins 3 caractères.");return;}
    setBusy(true);setNotice("");
    const {error}=await sb.rpc("suivi_create_patient_case",{
      p_patient_user_id:patientId,
      p_initial_diagnosis:diagnosis.trim(),
      p_monitoring_reason:reason.trim()||null
    });
    if(error){setNotice("Création refusée. Vérifiez que le patient a autorisé le dossier clinique et que votre agrément est valide.");setBusy(false);return;}
    setNotice("Dossier initial créé et diagnostic historisé.");await load();setBusy(false);
  }

  async function setCaseStatus(status:"active"|"paused"|"closed"){
    if(!caseRow)return;
    if(status==="closed"&&!window.confirm("Clôturer définitivement ce dossier ? Le professionnel ne pourra plus le réactiver."))return;
    setBusy(true);setNotice("");
    const {error}=await sb.rpc("suivi_set_patient_case_status",{p_case_id:caseRow.id,p_status:status});
    if(error){setNotice("Le changement de statut du dossier a échoué. Les droits actuels sont conservés.");setBusy(false);return;}
    setNotice(status==="active"?"Suivi repris.":status==="paused"?"Suivi mis en pause.":"Dossier clôturé définitivement.");
    await load();setBusy(false);
  }

  async function addEntry(){
    if(!caseRow){setNotice("Créez d'abord le dossier initial.");return;}
    if(caseRow.status!=="active"){setNotice("Le dossier est en pause ou clôturé. Aucune nouvelle entrée ne peut être ajoutée.");return;}
    if(note.trim().length<3){setNotice("L'entrée clinique doit contenir au moins 3 caractères.");return;}
    setBusy(true);setNotice("");
    const {error}=await sb.rpc("suivi_add_clinical_entry",{
      p_case_id:caseRow.id,p_entry_type:kind,p_content:note.trim()
    });
    if(error){setNotice("Enregistrement clinique refusé. Vérifiez vos droits et le consentement actif.");setBusy(false);return;}
    setNote("");setNotice(kind==="diagnosis"?"Diagnostic mis à jour et version précédente conservée dans l'historique.":"Observation enregistrée dans le dossier.");
    await load();setBusy(false);
  }

  if(loading)return <p className="rounded-xl bg-slate-50 p-3 text-sm">Chargement du dossier clinique autorisé…</p>;
  if(!allowed)return <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Le patient n'a pas autorisé l'ouverture de son dossier clinique. Les mesures, appareils et alertes restent masqués jusqu'à ce que ce droit soit accordé.</p>;
  return <section className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
    <div><h3 className="font-extrabold text-indigo-950">Dossier clinique de suivi</h3><p className="text-xs text-indigo-900">Les mesures autorisées en temps réel s’ajoutent automatiquement à la chronologie. Le diagnostic reste rédigé et validé par le professionnel.</p></div>
    {notice&&<p role="status" className="rounded-lg border bg-white p-2 text-sm">{notice}</p>}
    {!caseRow?<div className="space-y-2 rounded-xl border bg-white p-3">
      <p className="font-bold">Diagnostic ou motif initial requis avant le suivi clinique</p>
      <label className="block text-sm font-semibold">Diagnostic initial / motif de surveillance<textarea rows={3} maxLength={4000} value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} className="champ mt-1 w-full" placeholder="Rédigez votre appréciation clinique initiale…"/></label>
      <label className="block text-sm font-semibold">Motif de suivi (facultatif)<textarea rows={2} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} className="champ mt-1 w-full"/></label>
      <button disabled={busy} onClick={()=>void createCase()} className="min-h-10 rounded-lg bg-indigo-800 px-4 text-sm font-bold text-white disabled:opacity-40">Créer le dossier et enregistrer le diagnostic</button>
    </div>:<>
      <div className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><b>Diagnostic actuel</b><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900">{caseRow.status==="active"?"Actif":caseRow.status}</span></div>
        <p className="mt-2 whitespace-pre-wrap text-sm">{caseRow.initial_diagnosis}</p>
        {caseRow.monitoring_reason&&<p className="mt-2 text-xs text-slate-600">Motif : {caseRow.monitoring_reason}</p>}
        <p className="mt-2 text-xs text-slate-500">Mis à jour : {new Date(caseRow.updated_at).toLocaleString("fr-FR")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {caseRow.status==="active"&&<button type="button" disabled={busy} onClick={()=>void setCaseStatus("paused")} className="min-h-10 rounded-lg border px-3 text-xs font-bold">Mettre en pause</button>}
          {caseRow.status==="paused"&&<button type="button" disabled={busy} onClick={()=>void setCaseStatus("active")} className="min-h-10 rounded-lg border border-emerald-200 px-3 text-xs font-bold text-emerald-800">Reprendre le suivi</button>}
          {caseRow.status!=="closed"&&<button type="button" disabled={busy} onClick={()=>void setCaseStatus("closed")} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700">Clôturer définitivement</button>}
        </div>
      </div>
      {caseRow.status==="active"?<div className="space-y-2 rounded-xl border bg-white p-3">
        <b>Ajouter une mise à jour clinique</b>
        <label className="block text-sm font-semibold">Type d'entrée<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)} className="champ mt-1 w-full"><option value="observation">Observation</option><option value="follow_up">Compte rendu de suivi</option><option value="diagnosis">Mise à jour du diagnostic</option></select></label>
        <textarea rows={3} maxLength={6000} value={note} onChange={e=>setNote(e.target.value)} className="champ w-full" placeholder={kind==="diagnosis"?"Nouveau diagnostic / appréciation clinique…":"Observation professionnelle…"} />
        <button disabled={busy} onClick={()=>void addEntry()} className="min-h-10 rounded-lg bg-indigo-800 px-4 text-sm font-bold text-white disabled:opacity-40">Enregistrer dans l'historique clinique</button>
      </div>
      <div className="space-y-2"><b className="text-sm">Historique clinique</b>{entries.length?entries.map(entry=><article key={entry.id} className="rounded-xl border bg-white p-3"><div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{entry.entry_type==="diagnosis"?"Diagnostic":entry.entry_type==="follow_up"?"Suivi":entry.entry_type==="measurement"?"Mesure reçue automatiquement":"Observation"}</b><time className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString("fr-FR")}</time></div><p className="mt-2 whitespace-pre-wrap text-sm">{entry.content}</p></article>):<p className="text-sm text-slate-500">Aucune mise à jour supplémentaire.</p>}</div>
      </>:<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{caseRow.status==="paused"?"Le suivi est en pause. Les mesures et alertes restent masquées jusqu'à sa reprise.":"Le dossier est définitivement clôturé. Les données restent conservées dans le dossier patient en lecture seule."}</p>}
    </>}
  </section>;
}
