"use client";
import { useState } from "react";
type Cashier={id:string;username:string|null;first_name:string|null;last_name:string|null;pharmacie_id:string|null;actif:boolean};
export function CaisseSecurityManager({cashiers}:{cashiers:Cashier[]}){
 const [target,setTarget]=useState(cashiers[0]?.id||"");const [pin,setPin]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
 async function save(){setBusy(true);setError("");setMessage("");try{const r=await fetch("/api/caisse/security",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"configure-pin",targetUserId:target,pin})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Configuration impossible");setMessage(d.message||"PIN configuré.");setPin("");}catch(e){setError(e instanceof Error?e.message:"Erreur de configuration");}finally{setBusy(false);}}
 return <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
  <h2 className="text-lg font-extrabold">Sécurité des décaissements</h2>
  <p className="mt-1 text-sm text-slate-600">Configurez un PIN de 6 à 8 chiffres pour une caissière. Le PIN est stocké sous forme de dérivé cryptographique, jamais en clair. La caissière pourra ensuite enregistrer une biométrie sur son propre appareil dans l’écran Caisse.</p>
  {cashiers.length===0?<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">Aucune Caisse n’est disponible dans l’équipe.</p>:<div className="mt-3 grid gap-3 sm:grid-cols-2">
   <label className="text-sm font-semibold">Compte Caisse<select className="champ mt-1 w-full" value={target} onChange={e=>setTarget(e.target.value)} disabled={busy}>{cashiers.map(c=><option key={c.id} value={c.id}>{[c.first_name,c.last_name].filter(Boolean).join(" ")||c.username||c.id.slice(0,8)}{c.actif?"":" (inactif)"}</option>)}</select></label>
   <label className="text-sm font-semibold">Nouveau PIN<input className="champ mt-1 w-full" type="password" inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={8} pattern="[0-9]{6,8}" value={pin} onChange={e=>setPin(e.target.value)} placeholder="6 à 8 chiffres" disabled={busy}/></label>
   <div className="sm:col-span-2"><button type="button" className="btn btn-vert" onClick={()=>void save()} disabled={busy||!target||!/^[0-9]{6,8}$/.test(pin)}>{busy?"Enregistrement…":"Configurer le PIN"}</button></div>
  </div>}
  {message&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}{error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
 </section>;
}
