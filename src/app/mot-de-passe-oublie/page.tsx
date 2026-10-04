"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

const checks=(password:string)=>[
  password.length>=6,
  /[A-Z]/.test(password),
  /[0-9]/.test(password),
  /[^A-Za-z0-9]/.test(password),
];

function Formulaire(){
 const router=useRouter(), retour=useSearchParams().get("retour")||"/";
 const [step,setStep]=useState<"username"|"otp"|"password">("username");
 const [username,setUsername]=useState(""),[code,setCode]=useState(""),[password,setPassword]=useState(""),[confirmation,setConfirmation]=useState("");
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const passwordChecks=checks(password), passwordValid=passwordChecks.every(Boolean)&&password===confirmation;
 async function envoyer(e:React.FormEvent){
   e.preventDefault();setBusy(true);setError("");setMessage("");
   const res=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})});
   const data=await res.json();setBusy(false);setMessage(data.message||"Un code OTP a été envoyé si le compte existe.");setStep("otp");
 }
 async function verifier(e:React.FormEvent){
   e.preventDefault();setBusy(true);setError("");
   const {error}=await supabaseBrowser().auth.verifyOtp({email:await emailForReset(),token:code,type:"email"});
   setBusy(false);if(error){setError("Code incorrect ou expiré.");return}setStep("password");
 }
 async function emailForReset(){
   const res=await fetch("/api/auth/forgot-password/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})});
   const data=await res.json(); return data.email as string;
 }
 async function mettreAJour(e:React.FormEvent){
   e.preventDefault();if(!passwordValid){setError("Le mot de passe doit contenir au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.");return}
   setBusy(true);setError("");const {error}=await supabaseBrowser().auth.updateUser({password});if(error){setBusy(false);setError("Impossible de mettre à jour le mot de passe.");return}
   await supabaseBrowser().auth.signOut();setBusy(false);router.push(`/connexion?retour=${encodeURIComponent(retour)}&motDePasseMisAJour=1`);
 }
 return <form onSubmit={step==="username"?envoyer:step==="otp"?verifier:mettreAJour} className="carte w-full max-w-sm space-y-4">
  <h1 className="text-2xl font-extrabold">{step==="password"?"Modifier mot de passe":"Mot de passe oublié"}</h1>
  {step==="username"&&<><p className="text-sm leading-relaxed text-slate-600">Saisissez le nom d'utilisateur utilisé lors de la création du compte. NAXA enverra un code OTP à l'adresse e-mail associée.</p><label className="block text-sm font-semibold">Nom d'utilisateur<input className="champ mt-1" required value={username} onChange={e=>setUsername(e.target.value.replace(/\s/g,"").toLowerCase())} autoComplete="username"/></label><button className="btn btn-canari w-full" disabled={busy}>{busy?"Envoi...":"Recevoir l'OTP"}</button></>}
  {step==="otp"&&<><p className="rounded-xl2 bg-naxa-green-50 p-3 text-sm">{message||"Un code OTP a été envoyé à l'adresse e-mail associée."}</p><label className="block text-sm font-semibold">Code OTP<input className="champ mt-1 tracking-widest" required inputMode="numeric" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} autoComplete="one-time-code"/></label><button className="btn btn-canari w-full" disabled={busy}>{busy?"Vérification...":"Valider l'OTP"}</button><button type="button" className="btn btn-clair w-full" onClick={()=>{setStep("username");setCode("")}}>Modifier le nom d'utilisateur</button></>}
  {step==="password"&&<><label className="block text-sm font-semibold">Nouveau mot de passe<span className="relative mt-1 block"><input className="champ pr-20" required type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-xs font-bold" onClick={()=>setShow(!show)}>{show?"Masquer":"Afficher"}</button></span></label><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-naxa-canari transition-all" style={{width:`${passwordChecks.filter(Boolean).length*25}%`}}/></div><ul className="grid grid-cols-2 gap-1 text-xs text-slate-600">{passwordChecks.map((ok,i)=><li key={i} className={ok?"text-naxa-green-700":"text-slate-500"}>{ok?"✓":"○"} {["6 caractères minimum","1 majuscule","1 chiffre","1 caractère spécial"][i]}</li>)}</ul><label className="block text-sm font-semibold">Confirmer mot de passe<input className="champ mt-1" required type={show?"text":"password"} value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password"/></label><button className="btn btn-canari w-full" disabled={busy||!passwordValid}>{busy?"Mise à jour...":"Mettre à jour"}</button></>}
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {step!=="password"&&<p className="text-center text-sm"><Link href={`/connexion?retour=${encodeURIComponent(retour)}`} className="font-bold underline">Retour à la connexion</Link></p>}
 </form>
}

export default function MotDePasseOublie(){return <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-naxa-green-900 px-5"><Logo/><Suspense><Formulaire/></Suspense></main>}