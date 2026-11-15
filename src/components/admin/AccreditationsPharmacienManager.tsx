"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type AccreditationPharmacienRow = {
  id:string;
  profile_id:string;
  pharmacie_id:string;
  proposed_by:string;
  registration_number:string;
  issuing_authority:string;
  specialty:string|null;
  valid_until:string|null;
  status:"pending_admin"|"approved"|"rejected"|"revoked";
  created_at:string;
  review_note:string|null;
  credential_url:string|null;
  pharmacist_label:string;
  pharmacy_label:string;
  promoter_label:string;
};

const date=(value:string)=>new Date(value).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});

export function AccreditationsPharmacienManager({initialRows}:{initialRows:AccreditationPharmacienRow[]}){
  const [rows,setRows]=useState(initialRows);
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [busyId,setBusyId]=useState<string|null>(null);
  const [notice,setNotice]=useState("");

  async function decide(row:AccreditationPharmacienRow,decision:"approved"|"rejected"|"revoked"){
    const note=(notes[row.id]??"").trim();
    if((decision==="rejected"||decision==="revoked")&&note.length<5){
      setNotice("Un motif d'au moins 5 caractères est obligatoire pour refuser ou retirer un agrément.");
      return;
    }
    setBusyId(row.id);setNotice("");
    const sb=supabaseBrowser();
    const {data,error}=await sb.rpc("naxa_admin_decider_accreditation_pharmacien",{
      p_accreditation:row.id,p_decision:decision,p_note:note||null,
    });
    setBusyId(null);
    if(error){setNotice(error.message||"La décision Admin n'a pas été enregistrée.");return;}
    setRows(current=>current.map(item=>item.id===row.id?{...item,status:decision,review_note:note||null}:item));
    setNotice(decision==="approved"
      ?"Agrément validé. L'affectation Pharmacien est maintenant activable dans le périmètre approuvé."
      :decision==="rejected"?"Proposition refusée. Aucun poste Pharmacien n'a été créé."
      :"Agrément retiré. Le poste Pharmacien et ses RPC sont neutralisés.");
  }

  const pending=rows.filter(row=>row.status==="pending_admin");
  const reviewed=rows.filter(row=>row.status!=="pending_admin");
  const card=(row:AccreditationPharmacienRow)=><article key={row.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="font-extrabold">{row.pharmacist_label}</h2><p className="text-sm text-slate-600">{row.pharmacy_label}</p><p className="mt-1 text-xs text-slate-500">Proposé par {row.promoter_label} · {date(row.created_at)}</p></div>
      <span className={"rounded-full px-3 py-1 text-xs font-bold "+(row.status==="approved"?"bg-emerald-100 text-emerald-900":row.status==="pending_admin"?"bg-amber-100 text-amber-900":"bg-slate-100 text-slate-700")}>{row.status==="approved"?"Validé":row.status==="pending_admin"?"À vérifier":row.status==="rejected"?"Refusé":"Retiré"}</span>
    </div>
    <dl className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-slate-500">N° d'inscription</dt><dd className="font-semibold">{row.registration_number}</dd></div>
      <div><dt className="text-xs text-slate-500">Autorité émettrice</dt><dd className="font-semibold">{row.issuing_authority}</dd></div>
      <div><dt className="text-xs text-slate-500">Spécialité</dt><dd className="font-semibold">{row.specialty||"Non renseignée"}</dd></div>
      <div><dt className="text-xs text-slate-500">Validité du justificatif</dt><dd className="font-semibold">{row.valid_until?new Date(row.valid_until+"T12:00:00").toLocaleDateString("fr-FR"):"Non précisée"}</dd></div>
    </dl>
    {row.credential_url?<a href={row.credential_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-bold underline">Ouvrir le justificatif sécurisé</a>:<p className="text-sm text-red-700">Justificatif inaccessible : approbation interdite tant que le document n'est pas vérifiable.</p>}
    {row.review_note&&<p className="rounded-lg border bg-slate-50 p-3 text-sm">Dernière décision : {row.review_note}</p>}
    <label className="block text-sm font-semibold">Motif de décision (obligatoire pour refus/retrait)
      <textarea rows={2} maxLength={1000} value={notes[row.id]??""} onChange={event=>setNotes(current=>({...current,[row.id]:event.target.value}))} className="mt-1 w-full rounded-lg border p-3"/>
    </label>
    {row.status==="pending_admin"&&<div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>void decide(row,"approved")} disabled={busyId===row.id||!row.credential_url} className="min-h-10 rounded-xl bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busyId===row.id?"Traitement…":"Approuver et activer le poste"}</button>
      <button type="button" onClick={()=>void decide(row,"rejected")} disabled={busyId===row.id} className="min-h-10 rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-800 disabled:opacity-50">Refuser</button>
    </div>}
    {row.status==="approved"&&<button type="button" onClick={()=>void decide(row,"revoked")} disabled={busyId===row.id} className="min-h-10 rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-800 disabled:opacity-50">Retirer l'agrément et le poste</button>}
  </article>;

  return <section className="space-y-6">
    {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p>}
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Propositions à vérifier</h2><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{pending.length}</span></div>
      {pending.length?pending.map(card):<p className="rounded-xl border border-dashed p-5 text-sm text-slate-600">Aucune proposition en attente.</p>}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-extrabold">Historique des décisions</h2>
      {reviewed.length?reviewed.map(card):<p className="rounded-xl border border-dashed p-5 text-sm text-slate-600">Aucune décision antérieure.</p>}
    </section>
  </section>;
}
