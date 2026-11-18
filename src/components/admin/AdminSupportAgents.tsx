"use client";

import { useCallback, useEffect, useState } from "react";

const PERMISSIONS = [
  ["queue_view","Voir la file centrale"],
  ["ticket_view_assigned","Voir les dossiers attribués"],
  ["ticket_reply","Répondre aux demandeurs"],
  ["ticket_internal_note","Ajouter des notes internes"],
  ["attachments_read","Lire les pièces jointes"],
] as const;

type Agent = {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  status: "active" | "suspended" | "revoked" | "invited";
  presence: "available" | "unavailable";
  must_change_password: boolean;
  permissions: string[];
};

export function AdminSupportAgents() {
  const [agents,setAgents] = useState<Agent[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  const [temporaryPassword,setTemporaryPassword] = useState("");
  const [username,setUsername] = useState("");
  const [email,setEmail] = useState("");
  const [firstName,setFirstName] = useState("");
  const [lastName,setLastName] = useState("");
  const [dateOfBirth,setDateOfBirth] = useState("");
  const [permissions,setPermissions] = useState<string[]>(["queue_view","ticket_view_assigned","ticket_reply"]);
  const [editing,setEditing] = useState<Record<string,string[]>>({});

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/support-agents",{cache:"no-store"});
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "Liste indisponible.");
      setAgents(data.agents ?? []);
      setEditing(Object.fromEntries((data.agents ?? []).map((agent:Agent)=>[agent.user_id,agent.permissions])));
    } catch(cause) {
      setError(cause instanceof Error ? cause.message : "Liste indisponible.");
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{void refresh();},[refresh]);

  async function createAgent(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess(""); setTemporaryPassword("");
    try {
      const response=await fetch("/api/admin/support-agents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        username,email,first_name:firstName,last_name:lastName,date_of_birth:dateOfBirth,permissions,
      })});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || "Création impossible.");
      setTemporaryPassword(data.temporary_password);
      setSuccess("Compte Agent créé. Le mot de passe provisoire ne sera affiché qu’une seule fois.");
      setUsername("");setEmail("");setFirstName("");setLastName("");setDateOfBirth("");
      await refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:"Création impossible.");}
    finally {setSaving(false);}
  }

  async function updateAgent(agent:Agent, patch:Partial<Pick<Agent,"status"|"presence">> & {permissions?:string[]}) {
    setSaving(true);setError("");setSuccess("");
    try {
      const response=await fetch("/api/admin/support-agents",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        user_id:agent.user_id,status:patch.status ?? agent.status,presence:patch.presence ?? agent.presence,
        ...(patch.permissions ? {permissions:patch.permissions} : {}),
      })});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || "Mise à jour impossible.");
      setSuccess("Compte Agent mis à jour.");
      await refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:"Mise à jour impossible.");}
    finally {setSaving(false);}
  }

  function togglePermission(agentId:string,code:string,checked:boolean) {
    setEditing(current=>({
      ...current,
      [agentId]: code==="ticket_view_assigned"&&!checked
        ? []
        : checked?[...(current[agentId]??[]),code]:(current[agentId]??[]).filter(value=>value!==code),
    }));
  }

  return <div className="space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Administration NAXA</p><h1 className="mt-1 text-2xl font-black">Agents du service client</h1><p className="mt-1 text-sm text-slate-600">Comptes internes séparés des profils Client, Partenaire, Pharmacie et Admin.</p></header>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {success&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>}
    {temporaryPassword&&<section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="font-bold">Mot de passe provisoire — à transmettre de façon sécurisée</p>
      <p className="mt-2 break-all font-mono text-lg">{temporaryPassword}</p>
      <button type="button" onClick={()=>void navigator.clipboard.writeText(temporaryPassword)} className="mt-3 rounded-lg border border-amber-500 px-3 py-2 text-sm font-bold">Copier le mot de passe</button>
      <p className="mt-2 text-xs text-amber-900">L’Agent devra le remplacer à sa première connexion. Ne partagez pas ce mot de passe par email non chiffré.</p>
    </section>}
    <form onSubmit={createAgent} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-2">
      <h2 className="md:col-span-2 text-lg font-extrabold">Créer un compte individuel</h2>
      <input required minLength={3} maxLength={30} pattern="[a-z0-9][a-z0-9._-]{2,29}" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} placeholder="Nom d’utilisateur" className="rounded-xl border border-slate-300 p-3 text-sm"/>
      <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email professionnel" className="rounded-xl border border-slate-300 p-3 text-sm"/>
      <input required minLength={2} maxLength={80} value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Prénom" className="rounded-xl border border-slate-300 p-3 text-sm"/>
      <input required minLength={2} maxLength={80} value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Nom" className="rounded-xl border border-slate-300 p-3 text-sm"/>
      <label className="space-y-1 text-xs font-semibold text-slate-600">Date de naissance (18 ans minimum)<input required type="date" value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)} max={new Date().toISOString().slice(0,10)} className="block w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900"/></label>
      <div className="md:col-span-2"><p className="mb-2 text-sm font-bold">Permissions initiales</p><div className="grid gap-2 sm:grid-cols-2">
        {PERMISSIONS.map(([code,label])=><label key={code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={permissions.includes(code)} onChange={e=>setPermissions(current=>code==="ticket_view_assigned"&&!e.target.checked?[]:e.target.checked?[...current,code]:current.filter(v=>v!==code))}/>{label}</label>)}
      </div></div>
      <button disabled={saving} type="submit" className="rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white disabled:opacity-50 md:col-span-2">{saving?"Création…":"Créer l’Agent"}</button>
    </form>
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Comptes existants</h2><button type="button" onClick={()=>void refresh()} className="rounded-lg border px-3 py-2 text-sm font-semibold">Actualiser</button></div>
      {loading&&<p className="text-sm text-slate-500">Chargement…</p>}
      {!loading&&!agents.length&&<p className="rounded-xl bg-white p-4 text-sm text-slate-500">Aucun Agent créé.</p>}
      {agents.map(agent=><article key={agent.user_id} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{agent.first_name} {agent.last_name}</h3><p className="text-sm text-slate-500">@{agent.username}</p><p className="mt-1 text-xs">Statut : <strong>{agent.status}</strong> · Présence : <strong>{agent.presence}</strong>{agent.must_change_password?" · Mot de passe initial à changer":""}</p></div>
          <div className="flex flex-wrap gap-2">
            {agent.status==="active"&&<button disabled={saving} onClick={()=>void updateAgent(agent,{status:"suspended"})} className="rounded-lg border border-amber-500 px-3 py-2 text-xs font-bold">Suspendre</button>}
            {agent.status==="suspended"&&<button disabled={saving} onClick={()=>void updateAgent(agent,{status:"active"})} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold">Réactiver</button>}
            {agent.status!=="revoked"&&<button disabled={saving} onClick={()=>void updateAgent(agent,{status:"revoked"})} className="rounded-lg border border-red-500 px-3 py-2 text-xs font-bold text-red-700">Révoquer</button>}
            {agent.status==="active"&&<button disabled={saving} onClick={()=>void updateAgent(agent,{presence:agent.presence==="available"?"unavailable":"available"})} className="rounded-lg border px-3 py-2 text-xs font-bold">{agent.presence==="available"?"Indisponible":"Disponible"}</button>}
          </div>
        </div>
        <details><summary className="cursor-pointer text-sm font-bold">Gérer les permissions ({(editing[agent.user_id]??[]).length})</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{PERMISSIONS.map(([code,label])=><label key={code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(editing[agent.user_id]??[]).includes(code)} disabled={agent.status!=="active"} onChange={e=>togglePermission(agent.user_id,code,e.target.checked)}/>{label}</label>)}</div>
          <button type="button" disabled={saving||agent.status!=="active"} onClick={()=>void updateAgent(agent,{permissions:editing[agent.user_id]??[]})} className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Enregistrer les permissions</button>
        </details>
      </article>)}
    </section>
  </div>;
}
