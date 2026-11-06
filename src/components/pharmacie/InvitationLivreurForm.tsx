"use client";

import {useState,type FormEvent} from "react";
import {supabaseBrowser} from "@/lib/supabase/client";

type Pharmacy={id:string;nom:string};
export function InvitationLivreurForm({pharmacies,locked=false}:{pharmacies:Pharmacy[];locked?:boolean}){
  const [pharmacie,setPharmacie]=useState(pharmacies[0]?.id??"");
  const [email,setEmail]=useState("");
  const [inviteUrl,setInviteUrl]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);

  async function createInvite(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy||!pharmacie||!email.trim())return;
    setBusy(true);setError("");setInviteUrl("");setCopied(false);
    const {data,error:rpcError}=await supabaseBrowser().rpc("naxa_create_livreur_invite",{
      p_pharmacie:pharmacie,p_email:email.trim().toLowerCase(),
    });
    if(rpcError||typeof data!=="string"){
      setError(rpcError?.message??"Impossible de créer l’invitation. Vérifiez la pharmacie et vos droits.");
    }else{
      const url=new URL("/invitation/livreur",window.location.origin);
      url.searchParams.set("token",data);
      setInviteUrl(url.toString());
    }
    setBusy(false);
  }

  async function copyInvite(){
    if(!inviteUrl)return;
    try{
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    }catch{
      setError("Copie automatique indisponible. Sélectionnez le lien affiché et copiez-le.");
    }
  }

  return <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">＋</span>
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">Créer un compte Livreur</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Générez une invitation nominative. La personne crée ou utilise son compte NAXA, confirme son e-mail, complète son profil majeur et accepte ensuite l’affectation.</p>
      </div>
    </div>
    <form onSubmit={createInvite} className="mt-4 grid gap-3 sm:grid-cols-2">
      {!locked&&<label className="text-sm font-semibold text-slate-700 sm:col-span-2">Pharmacie
        <select value={pharmacie} onChange={e=>setPharmacie(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3">
          {pharmacies.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
      </label>}
      {locked&&pharmacies[0]&&<p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700 sm:col-span-2">{pharmacies[0].nom}</p>}
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Adresse e-mail du futur Livreur
        <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="livreur@exemple.com"/>
      </label>
      <button type="submit" disabled={busy||!pharmacie||!email.trim()} className="min-h-11 rounded-xl bg-[#0B3D26] px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">
        {busy?"Création du lien…":"Générer l’invitation Livreur"}
      </button>
    </form>
    {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {inviteUrl&&<div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p role="status" className="font-bold text-emerald-950">Invitation créée · valable 7 jours</p>
      <p className="mt-1 text-xs leading-5 text-emerald-900">Partagez ce lien au candidat par le canal de votre choix. NAXA ne déclenche aucun SMS ni WhatsApp automatique.</p>
      <input readOnly value={inviteUrl} onFocus={e=>e.currentTarget.select()} className="mt-3 w-full rounded-lg border border-emerald-200 bg-white p-3 text-xs text-slate-800"/>
      <button type="button" onClick={()=>void copyInvite()} className="mt-3 min-h-11 rounded-xl bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white">{copied?"Lien copié":"Copier le lien d’invitation"}</button>
    </div>}
  </section>;
}
