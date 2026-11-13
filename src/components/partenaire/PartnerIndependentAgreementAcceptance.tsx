"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Template={id:string;version:string;title:string;body:string;sha256:string};
export function PartnerIndependentAgreementAcceptance({
  partnerId,partnerName,template,existingStatus
}:{partnerId:string;partnerName:string;template:Template|null;existingStatus:string|null}){
  const [accepted,setAccepted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  async function submit(){
    if(!accepted||!template){setNotice("Lisez la convention publiée et cochez votre acceptation avant de continuer.");return;}
    setBusy(true);setNotice("");
    const sb=supabaseBrowser();
    const {data:auth}=await sb.auth.getUser();
    if(!auth.user){setBusy(false);setNotice("Session expirée. Reconnectez-vous.");return;}
    const {error}=await sb.rpc("partner_independent_agreement_accept",{p_partner_id:partnerId});
    setBusy(false);
    if(error){setNotice(error.message?.includes("Aucune convention")?"Aucune convention active n’est publiée par NAXA.": "Acceptation non enregistrée. Vérifiez que vous êtes le titulaire du Partenaire et que votre compte est actif.");return;}
    setNotice("Votre acceptation personnelle est enregistrée. L’accord reste en attente de validation Admin ; aucun droit indépendant n’est activé avant cette validation.");
    setAccepted(false);
  }
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-extrabold">{partnerName}</h2>
    {existingStatus==="active"?<p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Convention indépendante active. Ce Partenaire dispose du droit indépendant NAXA sous réserve de sa validité.</p>
    :existingStatus==="pending_review"?<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Convention acceptée par le titulaire et en attente de validation NAXA. Les droits indépendants restent fermés.</p>
    :template?<>
      <div className="mt-3 rounded-xl border bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Convention NAXA · Version {template.version}</p><h3 className="mt-1 font-bold">{template.title}</h3></div><span className="text-xs text-slate-500">À lire intégralement</span></div>
        <div className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-6 text-slate-700">{template.body}</div>
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-4 w-4"/>
        <span>Je suis le titulaire de ce Partenaire. J’accepte personnellement cette convention indépendante avec NAXA, distincte de tout contrat de travail ou d’affectation à une autre structure.</span>
      </label>
      <button type="button" disabled={!accepted||busy} onClick={()=>void submit()} className="mt-4 min-h-11 rounded-xl bg-[#064B2A] px-4 font-bold text-white disabled:opacity-50">{busy?"Enregistrement…":"Accepter la convention NAXA"}</button>
    </>:<p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Aucun modèle officiel de convention n’est publié actuellement. L’acceptation est donc désactivée ; aucun droit indépendant ne peut être accordé sans texte contractuel validé.</p>}
    {notice&&<p role="status" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}
  </article>;
}
