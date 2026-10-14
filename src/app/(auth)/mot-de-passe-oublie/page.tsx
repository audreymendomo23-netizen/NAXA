"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { notifierNAXA } from "@/components/NotificationGlobale";
import { BoutonNAXA } from "@/components/BoutonNAXA";
import { CodeOtp } from "@/components/CodeOtp";
import { ChampFlottant } from "@/components/ChampFlottant";
import { useAuthDraftState } from "@/components/auth/AuthDraftContext";

const checks=(password:string)=>[
  password.length>=6,
  /[A-Z]/.test(password),
  /[0-9]/.test(password),
  /[^A-Za-z0-9]/.test(password),
];

function Formulaire(){
 const router=useRouter(), search=useSearchParams(), retour=search.get("retour")||"/";
 const urlStep=search.get("etape");
 const allerEtape=(next:"username"|"otp"|"password")=>{setStep(next);const params=new URLSearchParams(search.toString());if(next==="username")params.delete("etape");else params.set("etape",next);const query=params.toString();router.push("/mot-de-passe-oublie"+(query?"?"+query:""),{scroll:false});};
 const [step,setStep]=useState<"username"|"otp"|"password">("username");
 useEffect(()=>{setStep(urlStep==="otp"||urlStep==="password"?urlStep:"username")},[urlStep]);
 useEffect(()=>{if(step!=="password"){setPassword("");setConfirmation("")}},[step]);
 const [otpVersion,setOtpVersion]=useState(0);
 const [username,setUsername]=useAuthDraftState("forgot.username",""); const [usernameRecognition,setUsernameRecognition]=useState<"idle"|"checking"|"recognized"|"unrecognized">("idle"); const [password,setPassword]=useState(""),[confirmation,setConfirmation]=useState("");
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[otpSeconds,setOtpSeconds]=useState(55),[resending,setResending]=useState(false);
 useEffect(()=>{if(error)notifierNAXA(error)},[error]);
 useEffect(()=>{
   const value=username.trim().toLowerCase();
   if(!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(value)){setUsernameRecognition("idle");return}
   const controller=new AbortController();
   setUsernameRecognition("checking");
   const timer=window.setTimeout(async()=>{
     try{
       const res=await fetch("/api/auth/username-recognition",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:value}),signal:controller.signal});
       const data=await res.json();
       if(!controller.signal.aborted)setUsernameRecognition(data.recognized?"recognized":"unrecognized");
     }catch{if(!controller.signal.aborted)setUsernameRecognition("idle")}
   },300);
   return()=>{window.clearTimeout(timer);controller.abort()};
 },[username]);
 useEffect(()=>{if(step!=="otp"||otpSeconds<=0)return;const timer=window.setTimeout(()=>setOtpSeconds(s=>Math.max(0,s-1)),1000);return()=>window.clearTimeout(timer)},[step,otpSeconds]);
 const passwordChecks=checks(password), passwordValid=passwordChecks.every(Boolean)&&password===confirmation;
 const showUsernameSubmit=username.trim().length>0||busy||Boolean(error);
 const showPasswordSubmit=password.length>0||confirmation.length>0||busy||Boolean(error);
 async function envoyer(e:React.FormEvent){
   e.preventDefault();setBusy(true);setError("");
   const res=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})});
   const data=await res.json();if(!res.ok){setBusy(false);if(res.status===404)setUsernameRecognition("unrecognized");setError(data.error||"Impossible de vérifier ce compte. Réessayez.");return}setUsernameRecognition("recognized");setOtpVersion(v=>v+1);setOtpSeconds(55);window.setTimeout(()=>{setBusy(false);allerEtape("otp");notifierNAXA(data.message||"Si ce nom d'utilisateur existe, un code OTP a été envoyé à l'adresse e-mail associée.")},450);
 }
 async function renvoyer(){if(otpSeconds>0||resending)return;setResending(true);setError("");try{const res=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})});const data=await res.json();if(!res.ok){setError(data.error||"Impossible de renvoyer le code.");return}setOtpVersion(v=>v+1);setOtpSeconds(55);notifierNAXA(data.message||"Si ce nom d'utilisateur existe, un code OTP a été envoyé à l'adresse e-mail associée.")}catch{setError("Impossible de renvoyer le code. Vérifiez votre connexion.")}finally{setResending(false)}}
 async function verifierCode(value:string){setBusy(true);setError("");try{const res=await fetch("/api/auth/forgot-password/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,token:value})});const data=await res.json();if(!res.ok){setError(data.error||"Code incorrect ou expiré.");return false}return true}catch{setError("Vérification impossible. Vérifiez votre connexion.");return false}finally{setBusy(false)}}
 async function mettreAJour(e:React.FormEvent){
   e.preventDefault();if(!passwordValid){setError(password!==confirmation?"Les deux mots de passe ne correspondent pas.":"Le mot de passe doit contenir au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.");return}
   setBusy(true);setError("");const {error}=await supabaseBrowser().auth.updateUser({password});if(error){setBusy(false);const details=String(error.message||"").toLowerCase();setError(/same|different.*password|new password.*old password|should be different/.test(details)?"Ce mot de passe est votre mot de passe actuel.":/password.*(weak|short|characters|requirements|strength)/.test(details)?"Utilisez un mot de passe plus sécurisé : au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.":"Impossible de mettre à jour le mot de passe. Vérifiez les critères et réessayez.");return}
   await supabaseBrowser().auth.signOut();setBusy(false);router.push(`/connexion?retour=${encodeURIComponent(retour)}&motDePasseMisAJour=1`);
 }
 return <form onSubmit={step==="username"?envoyer:step==="otp"?(e)=>e.preventDefault():mettreAJour} noValidate onInvalidCapture={(e)=>{e.preventDefault();const field=e.target as HTMLInputElement;setError(field.validity.typeMismatch?"Format invalide.":field.validity.valueMissing?"Ce champ est obligatoire.":"Vérifiez les informations saisies.")}} className="mx-auto w-full max-w-sm space-y-4 bg-transparent px-1 pb-5 pt-8 text-center shadow-none sm:pt-10">
  {step!=="otp"&&<h1 className="mb-3 text-center text-2xl font-extrabold">{step==="password"?"Modifier mot de passe":"Mot de passe oublié"}</h1>}
  {step==="username"&&<><p className="text-center text-sm leading-relaxed text-slate-600">Saisissez le nom d'utilisateur utilisé lors de la création du compte. NAXA enverra un code OTP à l'adresse e-mail associée.</p><div className="text-left [&_.naxa-field-label]:font-bold"><ChampFlottant id="forgot-username" label="Nom d’utilisateur" value={username} onChange={v=>{setUsername(v.replace(/\s/g,""));setUsernameRecognition("idle")}} autoComplete="username" required valid={usernameRecognition==="recognized"} validColor="#16A34A"/></div><div aria-hidden={!showUsernameSubmit} className={`overflow-hidden transition-all duration-200 ease-out ${showUsernameSubmit?"max-h-24 translate-y-0 opacity-100":"max-h-0 -translate-y-1 opacity-0"}`}><BoutonNAXA type="submit" importance="importante" className="btn-canari w-full" loading={busy} disabled={!showUsernameSubmit}>{busy?"Envoi...":"Recevoir l'OTP"}</BoutonNAXA></div></>}
  {step==="otp"&&<><CodeOtp key={otpVersion} longueur={6} verifier={verifierCode} onSucces={()=>allerEtape("password")} titre="Vérifiez votre code" disabled={busy}/><p className="text-center text-sm text-[#064B2A]">Vous n’avez pas reçu le code ? {otpSeconds>0?<span>Renvoyer dans {otpSeconds} s</span>:<button type="button" className="font-bold underline" disabled={resending} onClick={renvoyer}>{resending?"Envoi…":"Renvoyer le code"}</button>}</p><button type="button" className="btn btn-clair w-full" onClick={()=>{allerEtape("username");setOtpSeconds(55)}}>Modifier le nom d’utilisateur</button></>}
  {step==="password"&&<><ChampFlottant id="forgot-password" label="Nouveau mot de passe" type={show?"text":"password"} value={password} onChange={setPassword} autoComplete="new-password" required trailing={<button type="button" className="rounded-full px-2 text-xs font-bold" onClick={()=>setShow(!show)}>{show?"Masquer":"Afficher"}</button>}/><div aria-label={"Force du mot de passe : "+passwordChecks.filter(Boolean).length+" critères sur 4"} className="grid h-2 grid-cols-4 gap-1 overflow-hidden rounded-full bg-slate-200">{passwordChecks.map((ok,i)=><span key={i} className="rounded-full transition-all duration-300" style={{backgroundColor:ok?["#ef4444","#eab308","#22c55e","#f97316"][i]:"#d1d5db"}}/>)}</div><ul className="grid grid-cols-2 gap-1 text-xs text-slate-600">{passwordChecks.map((ok,i)=><li key={i} className={ok?"text-naxa-green-700":"text-slate-500"}>{ok?<span aria-hidden="true" className="mr-1 inline-block h-2 w-5 rounded-full bg-[#FF9F1C] align-middle"/>:<span aria-hidden="true" className="mr-1 inline-block h-2 w-5 rounded-full bg-slate-300 align-middle"/>} {["6 caractères minimum","1 majuscule","1 chiffre","1 caractère spécial"][i]}</li>)}</ul><ChampFlottant id="forgot-password-confirm" label="Confirmer le mot de passe" type={show?"text":"password"} value={confirmation} onChange={setConfirmation} autoComplete="new-password" required/><div aria-hidden={!showPasswordSubmit} className={`overflow-hidden transition-all duration-200 ease-out ${showPasswordSubmit?"max-h-24 translate-y-0 opacity-100":"max-h-0 -translate-y-1 opacity-0"}`}><BoutonNAXA type="submit" importance="importante" className="btn-canari w-full" loading={busy} disabled={!showPasswordSubmit}>{busy?"Mise à jour...":"Mettre à jour"}</BoutonNAXA></div></>}
  

 </form>
}

export default function MotDePasseOublie(){return <Suspense><Formulaire/></Suspense>;}
