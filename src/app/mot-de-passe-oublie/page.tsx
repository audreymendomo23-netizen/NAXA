"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { BulleErreur } from "@/components/BulleErreur";
import { BullesAuthentification } from "@/components/BullesAuthentification";
import { BoutonNAXA } from "@/components/BoutonNAXA";

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
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[otpSeconds,setOtpSeconds]=useState(40),[resending,setResending]=useState(false);
 useEffect(()=>{if(step!=="otp"||otpSeconds<=0)return;const timer=window.setTimeout(()=>setOtpSeconds(s=>Math.max(0,s-1)),1000);return()=>window.clearTimeout(timer)},[step,otpSeconds]);
 const passwordChecks=checks(password), passwordValid=passwordChecks.every(Boolean)&&password===confirmation;
 async function envoyer(e:React.FormEvent){
   e.preventDefault();setBusy(true);setError("");setMessage("");
   const res=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})});
   const data=await res.json();setBusy(false);if(!res.ok){setError(data.error||"Aucun compte ne correspond à ce nom d\'utilisateur.");return}setMessage(data.message||"Un code OTP a été envoyé.");setCode("");setOtpSeconds(40);setStep("otp");
 }
 async function renvoyer(){if(otpSeconds>0||resending)return;setResending(true);setError("");try{const res=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})});const data=await res.json();if(!res.ok){setError(data.error||"Impossible de renvoyer le code.");return}setCode("");setMessage(data.message||"Un nouveau code OTP a été envoyé.");setOtpSeconds(40)}catch{setError("Impossible de renvoyer le code. Vérifiez votre connexion.")}finally{setResending(false)}}
 async function verifier(e:React.FormEvent){
   e.preventDefault();setBusy(true);setError("");
   const res=await fetch("/api/auth/forgot-password/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,token:code})});
   const data=await res.json();setBusy(false);if(!res.ok){setError(data.error||"Code incorrect ou expiré.");return}setStep("password");
 }
 async function mettreAJour(e:React.FormEvent){
   e.preventDefault();if(!passwordValid){setError("Le mot de passe doit contenir au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.");return}
   setBusy(true);setError("");const {error}=await supabaseBrowser().auth.updateUser({password});if(error){setBusy(false);setError("Impossible de mettre à jour le mot de passe.");return}
   await supabaseBrowser().auth.signOut();setBusy(false);router.push(`/connexion?retour=${encodeURIComponent(retour)}&motDePasseMisAJour=1`);
 }
 return <form onSubmit={step==="username"?envoyer:step==="otp"?verifier:mettreAJour} onInvalidCapture={(e)=>{e.preventDefault();const field=e.target as HTMLInputElement;setError(field.validity.typeMismatch?"Format invalide.":field.validity.valueMissing?"Ce champ est obligatoire.":"Vérifiez les informations saisies.")}} className="relative z-10 w-full max-w-[420px] space-y-4 rounded-3xl border border-naxa-green-100 bg-white/90 p-5 shadow-xl backdrop-blur-md sm:p-7">
  <h1 className="text-2xl font-extrabold">{step==="password"?"Modifier mot de passe":"Mot de passe oublié"}</h1>
  {step==="username"&&<><p className="text-sm leading-relaxed text-slate-600">Saisissez le nom d'utilisateur utilisé lors de la création du compte. NAXA enverra un code OTP à l'adresse e-mail associée.</p><label className="block text-sm font-semibold">Nom d'utilisateur<input className="champ mt-1" required value={username} onChange={e=>setUsername(e.target.value.replace(/\s/g,""))} autoComplete="username"/></label><BoutonNAXA type="submit" importance="importante" className="btn-canari w-full" loading={busy}>{busy?"Envoi...":"Recevoir l'OTP"}</BoutonNAXA></>}
  {step==="otp"&&<><p className="rounded-xl2 bg-naxa-green-50 p-3 text-sm">{message||"Un code OTP a été envoyé à l'adresse e-mail associée."}</p><p role="timer" aria-live="polite" className="text-center text-sm font-bold">{otpSeconds>0?"Nouveau code disponible dans : 00:"+String(otpSeconds).padStart(2,"0"):"Vous pouvez demander un nouveau code."}</p><label className="block text-sm font-semibold">Code OTP<input className="champ mt-1 tracking-widest" required inputMode="numeric" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} autoComplete="one-time-code"/></label><BoutonNAXA type="submit" importance="importante" className="btn-canari w-full" loading={busy} disabled={!code.trim()}>{busy?"Vérification...":"Valider l'OTP"}</BoutonNAXA><button type="button" className="btn btn-clair w-full" disabled={otpSeconds>0||resending} onClick={renvoyer}>{resending?"Renvoi...":otpSeconds>0?"Renvoyer le code dans 00:"+String(otpSeconds).padStart(2,"0"):"Renvoyer un code"}</button><button type="button" className="btn btn-clair w-full" onClick={()=>{setStep("username");setCode("");setOtpSeconds(40)}}>Modifier le nom d'utilisateur</button></>}
  {step==="password"&&<><label className="block text-sm font-semibold">Nouveau mot de passe<span className="relative mt-1 block"><input className="champ pr-20" required type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-xs font-bold" onClick={()=>setShow(!show)}>{show?"Masquer":"Afficher"}</button></span></label><div aria-label={"Force du mot de passe : "+passwordChecks.filter(Boolean).length+" critères sur 4"} className="grid h-2 grid-cols-4 gap-1 overflow-hidden rounded-full bg-slate-200">{passwordChecks.map((ok,i)=><span key={i} className="rounded-full transition-all duration-300" style={{backgroundColor:ok?["#ef4444","#eab308","#22c55e","#f97316"][i]:"#d1d5db"}}/>)}</div><ul className="grid grid-cols-2 gap-1 text-xs text-slate-600">{passwordChecks.map((ok,i)=><li key={i} className={ok?"text-naxa-green-700":"text-slate-500"}>{ok?"✓":"○"} {["6 caractères minimum","1 majuscule","1 chiffre","1 caractère spécial"][i]}</li>)}</ul><label className="block text-sm font-semibold">Confirmer mot de passe<input className="champ mt-1" required type={show?"text":"password"} value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password"/></label><BoutonNAXA type="submit" importance="importante" className="btn-canari w-full" loading={busy} disabled={!passwordValid}>{busy?"Mise à jour...":"Mettre à jour"}</BoutonNAXA></>}
  {error&&<BulleErreur key={error} message={error}/>}
  {step!=="password"&&<p className="text-center text-sm"><Link href={`/connexion?retour=${encodeURIComponent(retour)}`} className="font-bold underline">Retour à la connexion</Link></p>}
 </form>
}

export default function MotDePasseOublie(){
 return (
  <main className="auth-ecran relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-naxa-green-900 px-4 !h-auto !min-h-[100dvh] !overflow-y-auto sm:px-6" style={{backgroundColor:"#F2FAF5"}}>
   <BullesAuthentification/>
   <header className="relative z-10 w-full shrink-0 pt-3" style={{paddingTop:"calc(env(safe-area-inset-top, 0px) + 12px)"}}>
    <div className="flex w-full items-center justify-between gap-3">
     <div className="logo-pastille"><Logo taille={30}/></div>
     <span className="inline-flex min-w-0 items-center gap-2 rounded-full border-[1.5px] border-naxa-green-100 bg-white/70 px-3 py-2 text-sm font-extrabold tracking-tight text-[#064B2A] shadow-sm sm:px-4 sm:text-base">
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#FFE33D] ring-[3px] ring-[#FFE33D]/40"/>
      Récupération du compte
     </span>
    </div>
   </header>
   <div className="relative z-10 flex w-full flex-1 items-start justify-center py-8">
    <div className="w-full max-w-[420px]">
     <Suspense><Formulaire/></Suspense>
    </div>
   </div>
  </main>
 );
}
