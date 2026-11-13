"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Template={id:string;version:string;title:string;body:string;sha256:string};
type Pending={
  id:string;partner_id:string;professional_user_id:string;agreement_version:string;accepted_at:string;
  partners:{name:string;city:string};
  profiles:{username:string|null;first_name:string|null;last_name:string|null};
  template:{version:string;title:string;body:string;sha256:string}|null;
};
async function sha256(value:string){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,"0")).join("");
}
export function PartnerIndependentAgreementAdmin({initialPending,template}:{initialPending:Pending[];template:Template|null}){
  const router=useRouter();
  const [pending,setPending]=useState(initialPending);
  const [version,setVersion]=useState("");
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState<string|null>(null);
  const [notice,setNotice]=useState("");

  async function publish(){
    if(version.trim().length<3||title.trim().length<3||body.trim().length<100){
      setNotice("Renseignez une version, un titre et le texte juridique complet (100 caractères minimum).");return;
    }
    setBusy("template");setNotice("");
    const hash=await sha256(body.trim());
    const sb=supabaseBrowser();
    const {error}=await sb.rpc("admin_publish_partner_independent_agreement_template",{
      p_version:version.trim(),p_title:title.trim(),p_body:body.trim(),p_sha256:hash
    });
    setBusy(null);
    if(error){setNotice("Publication refusée. Vérifiez le compte Admin actif, la version et le texte juridique.");return;}
    setNotice("Nouvelle version de la convention publiée. Les prochaines acceptations utiliseront ce texte.");
    setVersion("");setTitle("");setBody("");router.refresh();
  }

  async function decide(row:Pending,approve:boolean){
    if(!approve&&reason.trim().length<5){setNotice("Indiquez un motif de refus de 5 caractères minimum.");return;}
    setBusy(row.id);setNotice("");
    const sb=supabaseBrowser();
    const {error}=await sb.rpc("admin_review_partner_independent_agreement",{
      p_agreement_id:row.id,p_approve:approve,p_expires_at:null,p_reason:approve?null:reason.trim()
    });
    setBusy(null);
    if(error){setNotice("Décision non enregistrée. Vérifiez que le Partenaire et son titulaire sont actifs.");return;}
    setPending(current=>current.filter(item=>item.id!==row.id));
    setReason("");
    setNotice(approve?"Convention activée après validation Admin.":"Convention refusée avec motif enregistré.");
    router.refresh();
  }

  return <div className="space-y-6">
    {notice&&<p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-extrabold">Modèle officiel de convention</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Aucun texte juridique n’est prérempli. Publiez uniquement une version relue et validée par NAXA ; son empreinte SHA-256 est enregistrée au moment de la publication.</p>
      {template&&<p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">Version publiée : <strong>{template.version}</strong> — {template.title}</p>}
      <div className="mt-4 grid gap-3">
        <label className="text-sm font-semibold">Version<input value={version} onChange={e=>setVersion(e.target.value)} maxLength={80} className="mt-1 min-h-10 w-full rounded-lg border px-3" placeholder="NAXA-PRESTATIONS-2026-01"/></label>
        <label className="text-sm font-semibold">Titre<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} className="mt-1 min-h-10 w-full rounded-lg border px-3" placeholder="Convention indépendante Partenaire"/></label>
        <label className="text-sm font-semibold">Texte intégral de la convention<textarea value={body} onChange={e=>setBody(e.target.value)} rows={12} className="mt-1 w-full rounded-lg border p-3 text-sm" placeholder="Insérez ici le texte juridique validé par NAXA."/></label>
        <button type="button" disabled={busy==="template"} onClick={()=>void publish()} className="min-h-11 rounded-xl bg-[#123D68] px-4 font-bold text-white disabled:opacity-50">{busy==="template"?"Publication…":"Publier cette version officielle"}</button>
      </div>
    </section>

    <section className="space-y-3">
      <div><h2 className="text-lg font-extrabold">Conventions acceptées en attente</h2><p className="mt-1 text-sm text-slate-600">L’acceptation par le titulaire ne suffit pas : un Admin actif doit encore approuver.</p></div>
      {!pending.length?<p className="rounded-xl border border-dashed p-5 text-sm text-slate-600">Aucune convention en attente de validation.</p>:pending.map(row=><article key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 className="font-extrabold">{row.partners?.name??"Partenaire"}</h3>
        <p className="mt-1 text-sm text-slate-600">{[row.partners?.city,row.profiles?.first_name,row.profiles?.last_name].filter(Boolean).join(" · ")}</p>
        <p className="mt-1 text-xs text-slate-500">Titulaire : {row.profiles?.username??row.professional_user_id} · Version {row.agreement_version}</p>
        <p className="mt-1 text-xs text-slate-500">Acceptée le {new Date(row.accepted_at).toLocaleString("fr-FR",{timeZone:"Africa/Douala"})}</p>
        {row.template&&<details className="mt-3 rounded-lg border bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-bold">{row.template.title} — texte exact accepté (version {row.template.version})</summary><div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">{row.template.body}</div><p className="mt-2 break-all text-[11px] text-slate-500">SHA-256 : {row.template.sha256}</p></details>}
        {!row.template&&<p className="mt-2 text-xs text-amber-800">La version exacte du texte accepté est introuvable. Ne pas approuver sans vérification documentaire.</p>}
        <label className="mt-3 block text-sm font-semibold">Motif (obligatoire en cas de refus)<input value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border px-3"/></label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy===row.id} onClick={()=>void decide(row,true)} className="min-h-10 rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white disabled:opacity-50">Approuver et activer</button>
          <button type="button" disabled={busy===row.id} onClick={()=>void decide(row,false)} className="min-h-10 rounded-lg border border-red-200 px-4 text-sm font-bold text-red-700 disabled:opacity-50">Refuser</button>
        </div>
      </article>)}
    </section>
  </div>;
}
