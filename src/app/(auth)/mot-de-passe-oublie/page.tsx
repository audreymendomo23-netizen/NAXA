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
 const [username,setUsername]=useAuthDraftState("forgot.username",""); const [usernameRecognition,setUsernameRecognition]=useState<"idle"|"recognized"|"unrecognized">("idle"); const [password,setPassword]=useState(""),[confirmation,setConfirmation]=useState("");
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[otpSeconds,setOtpSeconds]=useState(28),[resending,setResending]=useState(false);
 useEffect(()=>{if(error)notifierNAXA(error)},[error]);
 useEffect(()=>{if(step!=="otp"||otpSeconds<=0)return;const timer=window.setTimeout(()=>setOtpSeconds(s=>Math.max(0,s-1)),1000);return()=>window.clearTimeout(timer)},[step,otpSeconds]);
 const passwordChecks=checks(password), passwordValid=passwordChecks.every(Boolean)&&password===confirmation;
 async function envoyer(e:React.FormEvent){
   e.preventDefault();setBusy(true);setError("");setMessage("");
   const res=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})});
   const data=await res.json();if(!res.ok){setBusy(false);if(res.status===404)setUsernameRecognition("unrecognized");setError(data.error||"Impossible de vérifier ce compte. Réessayez.");return}setUsernameRecognition("recognized");setMessage(data.message||"Un code OTP a été envoyé.");setOtpVersion(v=>v+1);setOtpSeconds(28);window.setTimeout(()=>{setBusy(false);allerEtape("otp")},450);
 }
 async function renvoyer(){if(otpSeconds>0||resending)return;setResending(true);setError("");try{const res=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})});const data=await res.json();if(!res.ok){setError(data.error||"Impossible de renvoyer le code.");return}setOtpVersion(v=>v+1);setMessage(data.message||"Un nouveau code OTP a été envoyé.");setOtpSeconds(28)}catch{setError("Impossible de renvoyer le code. Vérifiez votre connexion.")}finally{setResending(false)}}
 async function verifierCode(value:string){setBusy(true);setError("");try{const res=await fetch("/api/auth/forgot-password/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,token:value})});const data=await res.json();if(!res.ok){setError(data.error||"Code incorrect ou expiré.");return false}return true}catch{setError("Vérification impossible. Vérifiez votre connexion.");return false}finally{setBusy(false)}}
 async function mettreAJour(e:React.FormEvent){
   e.preventDefault();if(!passwordValid){setError("Le mot de passe doit contenir au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.");return}
   setBusy(true);setError("");const {error}=await supabaseBrowser().auth.updateUser({password});if(error){setBusy(false);setError("Impossible de mettre à jour le mot de passe.");return}
   await supabaseBrowser().auth.signOut();setBusy(false);router.push(`/connexion?retour=${encodeURIComponent(retour)}&motDePasseMisAJour=1`);
 }
 return <form onSubmit={step==="username"?envoyer:step==="otp"?(e)=>e.preventDefault():mettreAJour} onInvalidCapture={(e)=>{e.preventDefault();const field=e.target as HTMLInputElement;setError(field.validity.typeMismatch?"Format invalide.":field.validity.valueMissing?"Ce champ est obligatoire.":"Vérifiez les informations saisies.")}} className="w-full max-w-sm space-y-3 bg-transparent p-0 shadow-none">
  {step!=="otp"&&<h1 className="text-2xl font-extrabold">{step==="password"?"Modifier mot de passe":"Mot de passe oublié"}</h1>}
  {step==="username"&&<><p className="text-sm leading-relaxed text-slate-600">Saisissez le nom d'utilisateur utilisé lors de la création du compte. NAXA enverra un code OTP à l'adresse e-mail associée.</p><ChampFlottant id="forgot-username" label="Nom d’utilisateur" value={username} onChange={v=>{setUsername(v.replace(/\s/g,""));setUsernameRecognition("idle")}} autoComplete="username" required trailing={usernameRecognition==="recognized"?<span aria-label="Nom d’utilisateur reconnu" className="text-xl font-extrabold text-[#D4A900]">✓</span>:usernameRecognition==="unrecognized"?<span aria-label="Nom d’utilisateur non reconnu" className="text-lg">❌</span>:undefined}/><BoutonNAXA type="submit" importance="importante" className="btn-canari w-full" loading={busy}>{busy?"Envoi...":"Recevoir l'OTP"}</BoutonNAXA></>}
  {step==="otp"&&<><p className="rounded-2xl border border-[#D8E9DE] bg-white p-3 text-sm text-[#064B2A]">{message||"Un code OTP a été envoyé à l’adresse e-mail associée."}</p><CodeOtp key={otpVersion} longueur={6} verifier={verifierCode} onSucces={()=>allerEtape("password")} titre="Vérifiez votre code" description="Entrez le code à 6 chiffres envoyé à l’adresse e-mail associée à ce compte." disabled={busy}/><p className="text-center text-sm text-[#064B2A]">Vous n’avez pas reçu le code ? {otpSeconds>0?<span>Renvoyer dans {otpSeconds} s</span>:<button type="button" className="font-bold underline" disabled={resending} onClick={renvoyer}>{resending?"Envoi…":"Renvoyer le code"}</button>}</p><button type="button" className="btn btn-clair w-full" onClick={()=>{allerEtape("username");setOtpSeconds(28)}}>Modifier le nom d’utilisateur</button></>}
  {step==="password"&&<><ChampFlottant id="forgot-password" label="Nouveau mot de passe" type={show?"text":"password"} value={password} onChange={setPassword} autoComplete="new-password" required trailing={<button type="button" className="rounded-full px-2 text-xs font-bold" onClick={()=>setShow(!show)}>{show?"Masquer":"Afficher"}</button>}/><div aria-label={"Force du mot de passe : "+passwordChecks.filter(Boolean).length+" critères sur 4"} className="grid h-2 grid-cols-4 gap-1 overflow-hidden rounded-full bg-slate-200">{passwordChecks.map((ok,i)=><span key={i} className="rounded-full transition-all duration-300" style={{backgroundColor:ok?["#ef4444","#eab308","#22c55e","#f97316"][i]:"#d1d5db"}}/>)}</div><ul className="grid grid-cols-2 gap-1 text-xs text-slate-600">{passwordChecks.map((ok,i)=><li key={i} className={ok?"text-naxa-green-700":"text-slate-500"}>{ok?"✓":"○"} {["6 caractères minimum","1 majuscule","1 chiffre","1 caractère spécial"][i]}</li>)}</ul><ChampFlottant id="forgot-password-confirm" label="Confirmer le mot de passe" type={show?"text":"password"} value={confirmation} onChange={setConfirmation} autoComplete="new-password" required/><BoutonNAXA type="submit" importance="importante" className="btn-canari w-full" loading={busy} disabled={!passwordValid}>{busy?"Mise à jour...":"Mettre à jour"}</BoutonNAXA></>}
  
  {step!=="password"&&<p className="text-center text-sm"><Link href={`/connexion?retour=${encodeURIComponent(retour)}`} className="font-bold underline">Retour à la connexion</Link></p>}
 </form>
}

export default function MotDePasseOublie(){return <Suspense><Formulaire/></Suspense>;}
