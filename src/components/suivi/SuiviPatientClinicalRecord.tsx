"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type PatientCase={
  id:string;professional_user_id:string;initial_diagnosis:string;
  monitoring_reason:string|null;status:"active"|"paused"|"closed";
  created_at:string;updated_at:string;
};
type ClinicalEntry={
  id:string;case_id:string;entry_type:"diagnosis"|"observation"|"follow_up"|"measurement";
  content:string;created_at:string;measurement_id:string|null;
};

const entryLabels:Record<ClinicalEntry["entry_type"],string>={
  diagnosis:"Diagnostic professionnel",
  observation:"Observation",
  follow_up:"Compte rendu de suivi",
  measurement:"Mesure reçue automatiquement"
};

export function SuiviPatientClinicalRecord(){
  const sb=useMemo(()=>supabaseBrowser(),[]);
  const [cases,setCases]=useState<PatientCase[]>([]);
  const [entries,setEntries]=useState<ClinicalEntry[]>([]);
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setNotice("");
    const {data:auth,error:authError}=await sb.auth.getUser();
    if(authError||!auth.user){
      setNotice("Connectez-vous pour consulter votre dossier clinique.");setLoading(false);return;
    }
    const {data:caseRows,error:caseError}=await sb.from("suivi_patient_cases")
      .select("id,professional_user_id,initial_diagnosis,monitoring_reason,status,created_at,updated_at")
      .eq("patient_user_id",auth.user.id).order("updated_at",{ascending:false});
    if(caseError){
      setNotice("Le dossier clinique patient n'est pas disponible dans cette version du service.");setLoading(false);return;
    }
    const records=(caseRows??[]) as PatientCase[];
    let history:ClinicalEntry[]=[];
    if(records.length){
      const {data:entryRows,error:entryError}=await sb.from("suivi_clinical_entries")
        .select("id,case_id,entry_type,content,created_at,measurement_id")
        .in("case_id",records.map(row=>row.id)).order("created_at",{ascending:false}).limit(1000);
      if(entryError){
        setCases(records);setNotice("Votre diagnostic est accessible, mais une partie de l'historique n'a pas pu être chargée.");setLoading(false);return;
      }
      history=(entryRows??[]) as ClinicalEntry[];
    }
    setCases(records);setEntries(history);setLoading(false);
  },[sb]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    const channel=sb.channel("suivi-dossier-patient")
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_patient_cases"},()=>{void load();})
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_clinical_entries"},()=>{void load();})
      .subscribe();
    return ()=>{void sb.removeChannel(channel);};
  },[sb,load]);

  return <section className="mt-5 rounded-2xl border border-indigo-100 bg-white p-4">
    <div>
      <h3 className="text-lg font-extrabold text-indigo-950">Mon dossier clinique</h3>
      <p className="mt-1 text-sm text-slate-600">Lecture personnelle de vos diagnostics et des notes de suivi rédigés par les professionnels. NAXA n'établit aucun diagnostic.</p>
    </div>
    {loading?<p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Chargement du dossier clinique…</p>
    :notice?<p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>
    :!cases.length?<p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-slate-600">Aucun dossier clinique n'a encore été ouvert par un professionnel de santé autorisé.</p>
    :<div className="mt-3 space-y-3">{cases.map(row=>{
      const history=entries.filter(entry=>entry.case_id===row.id);
      return <article key={row.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="text-sm text-indigo-950">Suivi professionnel</b>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-700">{row.status==="active"?"En cours":row.status==="paused"?"En pause":"Clôturé"}</span>
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Diagnostic initial / actuel</p>
        <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">{row.initial_diagnosis}</p>
        {row.monitoring_reason&&<p className="mt-2 text-sm text-slate-600">Motif du suivi : {row.monitoring_reason}</p>}
        <p className="mt-2 text-xs text-slate-500">Dernière mise à jour : {new Date(row.updated_at).toLocaleString("fr-FR")}</p>
        <div className="mt-3 border-t border-indigo-100 pt-3">
          <b className="text-sm">Chronologie du dossier</b>
          {!history.length?<p className="mt-2 text-sm text-slate-500">Aucune entrée supplémentaire.</p>
          :<ol className="mt-2 space-y-2">{history.map(entry=><li key={entry.id} className="rounded-lg border border-indigo-100 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-xs text-indigo-900">{entryLabels[entry.entry_type]??"Entrée clinique"}</b><time className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString("fr-FR")}</time></div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{entry.content}</p>
          </li>)}</ol>}
        </div>
      </article>;
    })}</div>}
  </section>;
}
