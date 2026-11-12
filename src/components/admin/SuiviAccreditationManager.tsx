"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type AccreditationRow = {
  user_id:string;professional_role:string;display_name:string;registration_number:string|null;
  issuing_authority:string|null;specialty:string|null;credential_storage_path:string|null;
  verification_status:string;verified:boolean;verified_at:string|null;verification_expires_at:string|null;
  created_at:string;document_url:string|null;
};
export function SuiviAccreditationManager({initialRows}:{initialRows:AccreditationRow[]}){
  const [rows,setRows]=useState(initialRows);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [notice,setNotice]=useState("");
  async function update(row:AccreditationRow,status:"verified"|"rejected"){
    if(status==="verified"&&(!row.registration_number||!row.issuing_authority||!row.credential_storage_path)){
      setNotice("Validation refusée : numéro, autorité et justificatif sont obligatoires.");return;
    }
    if(status==="verified"&&row.verification_expires_at&&new Date(row.verification_expires_at).getTime()<Date.now()){
      setNotice("Validation refusée : le justificatif est expiré.");return;
    }
    setBusyId(row.user_id);setNotice("");
    const sb=supabaseBrowser();const {data:auth}=await sb.auth.getUser();
    if(!auth.user){setNotice("Session Admin expirée.");setBusyId(null);return;}
    const now=new Date().toISOString();
    const {error}=await sb.from("suivi_professionals").update({
      verified:status==="verified",verification_status:status,verified_by:status==="verified"?auth.user.id:null,
      verified_at:status==="verified"?now:null
    }).eq("user_id",row.user_id);
    if(error)setNotice("Mise à jour refusée. Vérifiez vos droits Admin et la migration d'accréditation.");
    else{
      setRows(previous=>previous.map(item=>item.user_id===row.user_id?{...item,verified:status==="verified",verification_status:status,verified_at:status==="verified"?now:null}:item));
      setNotice(status==="verified"?"Accréditation validée. Le professionnel entre dans l'annuaire NAXA.":"Demande rejetée. Le professionnel n'apparaît pas dans l'annuaire.");
    }
    setBusyId(null);
  }
  return <section className="space-y-4">
    {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">{notice}</p>}
    {!rows.length?<p className="rounded-xl border border-dashed p-5 text-sm text-slate-600">Aucun dossier d'accréditation enregistré.</p>:rows.map(row=><article key={row.user_id} className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-extrabold">{row.display_name}</h2><p className="text-sm text-slate-600">{row.professional_role} · {row.specialty||"Spécialité non renseignée"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{row.verification_expires_at&&new Date(row.verification_expires_at).getTime()<=Date.now()?"Agrément expiré":row.verification_status}</span></div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">N° d'inscription</dt><dd className="font-semibold">{row.registration_number||"Non renseigné"}</dd></div><div><dt className="text-slate-500">Autorité émettrice</dt><dd className="font-semibold">{row.issuing_authority||"Non renseignée"}</dd></div><div><dt className="text-slate-500">Expiration</dt><dd className="font-semibold">{row.verification_expires_at?new Date(row.verification_expires_at).toLocaleDateString("fr-FR"):"Non renseignée"}</dd></div><div><dt className="text-slate-500">Compte</dt><dd className="font-mono text-xs">{row.user_id}</dd></div></dl>
      {row.document_url?<a className="mt-3 inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-bold underline" href={row.document_url} target="_blank" rel="noreferrer">Consulter le justificatif</a>:<p className="mt-3 text-sm text-amber-800">Justificatif absent ou inaccessible.</p>}
      <div className="mt-4 flex flex-wrap gap-2"><button disabled={busyId===row.user_id||(row.verification_status==="verified"&&(!row.verification_expires_at||new Date(row.verification_expires_at).getTime()>Date.now()))} onClick={()=>void update(row,"verified")} className="min-h-10 rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white disabled:opacity-40">Valider l'accréditation</button><button disabled={busyId===row.user_id||row.verification_status==="rejected"} onClick={()=>void update(row,"rejected")} className="min-h-10 rounded-lg border border-red-200 px-4 text-sm font-bold text-red-700 disabled:opacity-40">Rejeter</button></div>
    </article>)}
  </section>;
}
