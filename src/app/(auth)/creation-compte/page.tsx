"use client";
import { Suspense,useEffect,useMemo,useRef,useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter,useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ChampFlottant } from "@/components/ChampFlottant";
import { CodeOtp } from "@/components/CodeOtp";
import { useAuthDraftState, useClearSignupDrafts } from "@/components/auth/AuthDraftContext";
import { notifierNAXA } from "@/components/NotificationGlobale";
import { SuccesCreationCompte } from "@/components/SuccesCreationCompte";
import { BoutonNAXA } from "@/components/BoutonNAXA";

const COUNTRIES=[["CM","🇨🇲","+237","Cameroun",9],["AO","🇦🇴","+244","Angola",9],["BI","🇧🇮","+257","Burundi",8],["CF","🇨🇫","+236","Centrafrique",8],["TD","🇹🇩","+235","Tchad",8],["CG","🇨🇬","+242","Congo",9],["CD","🇨🇩","+243","RDC",9],["GQ","🇬🇶","+240","Guinée équatoriale",9],["GA","🇬🇦","+241","Gabon",8],["RW","🇷🇼","+250","Rwanda",9],["ST","🇸🇹","+239","São Tomé-et-Príncipe",7]] as const;
function ageOf(v:string){const d=new Date(v+"T00:00:00");if(!v||Number.isNaN(d.getTime()))return null;const n=new Date();let a=n.getFullYear()-d.getFullYear();const m=n.getMonth()-d.getMonth();if(m<0||(m===0&&n.getDate()<d.getDate()))a--;return a}

function safeInternalPath(value:string|null){
 if(!value||!value.startsWith("/"))return "/";
 try{const target=new URL(value,"https://naxa.invalid");return target.origin==="https://naxa.invalid"?target.pathname+target.search+target.hash:"/"}catch{return "/"}
}
function Formulaire(){
 const router=useRouter(), search=useSearchParams(), retour=safeInternalPath(search.get("retour"));
 const clearSignupDrafts=useClearSignupDrafts();
 const urlStep=search.get("etape");
 const allerEtape=(next:"details"|"otp"|"password")=>{setStep(next);const params=new URLSearchParams(search.toString());if(next==="details")params.delete("etape");else params.set("etape",next);const query=params.toString();router.push("/creation-compte"+(query?"?"+query:""),{scroll:false});};
 const [nom,setNom]=useAuthDraftState("signup.nom",""),[prenom,setPrenom]=useAuthDraftState("signup.prenom",""),[username,setUsername]=useAuthDraftState("signup.username","");
 const [uState,setUState]=useState<"idle"|"checking"|"available"|"taken">("idle");
 const [country,setCountry]=useAuthDraftState("signup.country","CM"),[phone,setPhone]=useAuthDraftState("signup.phone",""),[countryOpen,setCountryOpen]=useState(false),[dob,setDob]=useAuthDraftState("signup.dob",""),[email,setEmail]=useAuthDraftState("signup.email","");
 const countryPickerRef=useRef<HTMLSpanElement|null>(null), countryMenuRef=useRef<HTMLSpanElement|null>(null);
 const [countryMenuPosition,setCountryMenuPosition]=useState<{left:number;top:number;maxHeight:number;width:number}|null>(null);
 useEffect(()=>{
  if(!countryOpen)return;
  const positionMenu=()=>{
   const rect=countryPickerRef.current?.getBoundingClientRect();if(!rect)return;
   const viewport=window.visualViewport, viewportTop=viewport?.offsetTop??0, viewportHeight=viewport?.height??window.innerHeight;
   const width=Math.min(256,Math.max(180,window.innerWidth-24));
   const left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12));
   const below=Math.max(0,viewportTop+viewportHeight-rect.bottom-12), above=Math.max(0,rect.top-viewportTop-12);
   const belowPreferred=below>=Math.min(180,viewportHeight-24)||below>=above;
   const available=belowPreferred?below:above;
   const maxHeight=Math.max(80,Math.min(260,available,viewportHeight-24));
   const proposedTop=belowPreferred&&below>=100?rect.bottom+4:above>=100?rect.top-maxHeight-4:viewportTop+12;
   const top=Math.max(viewportTop+12,Math.min(proposedTop,viewportTop+viewportHeight-maxHeight-12));
   setCountryMenuPosition({left,top,maxHeight,width});
  };
  positionMenu();
  const outside=(event:PointerEvent)=>{const target=event.target as Node;if(!countryPickerRef.current?.contains(target)&&!countryMenuRef.current?.contains(target))setCountryOpen(false)};
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setCountryOpen(false)};
  window.addEventListener("resize",positionMenu);window.addEventListener("scroll",positionMenu,true);
  window.visualViewport?.addEventListener("resize",positionMenu);window.visualViewport?.addEventListener("scroll",positionMenu);
  document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
  return()=>{window.removeEventListener("resize",positionMenu);window.removeEventListener("scroll",positionMenu,true);window.visualViewport?.removeEventListener("resize",positionMenu);window.visualViewport?.removeEventListener("scroll",positionMenu);document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape)};
 },[countryOpen]);
 const [consent,setConsent]=useAuthDraftState("signup.consent",false); const [step,setStep]=useState<"details"|"otp"|"password">("details"),[otpVersion,setOtpVersion]=useState(0);
 useEffect(()=>{setStep(urlStep==="otp"||urlStep==="password"?urlStep:"details")},[urlStep]);
 useEffect(()=>{if(step!=="password"){setPassword("");setConfirmation("")}},[step]);
 const [password,setPassword]=useState(""),[confirmation,setConfirmation]=useState(""),[show,setShow]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false),[otpSeconds,setOtpSeconds]=useState(60),[resending,setResending]=useState(false),[successDestination,setSuccessDestination]=useState<string|null>(null);
 useEffect(()=>{if(error)notifierNAXA(error)},[error]);
 const selected=COUNTRIES.find(c=>c[0]===country)??COUNTRIES[0], digits=phone.replace(/\D/g,""), age=useMemo(()=>ageOf(dob),[dob]);
 useEffect(()=>{const v=username.trim().toLowerCase();if(!v){setUState("idle");return}if(!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(v)){setUState("taken");return}const controller=new AbortController();setUState("checking");const t=setTimeout(async()=>{try{const r=await fetch("/api/auth/username-availability",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:v}),signal:controller.signal});const d=await r.json();if(!controller.signal.aborted)setUState(d.available?"available":"taken")}catch{if(!controller.signal.aborted)setUState("taken")}},350);return()=>{clearTimeout(t);controller.abort()}},[username]);
 useEffect(()=>{if(step!=="otp"||otpSeconds<=0)return;const timer=window.setTimeout(()=>setOtpSeconds(s=>Math.max(0,s-1)),1000);return()=>window.clearTimeout(timer)},[step,otpSeconds]);
 const phoneValid=digits.length===selected[4], checks=[password.length>=6,/[A-Z]/.test(password),/[0-9]/.test(password),/[^A-Za-z0-9]/.test(password)], score=checks.filter(Boolean).length, passwordValid=score===4&&password===confirmation;
 const detailsHasInput=[nom,prenom,username,phone,dob,email].some(value=>value.trim().length>0);
 const passwordHasInput=password.length>0||confirmation.length>0;
 const showDetailsSubmit=detailsHasInput||busy||Boolean(error);
 const showPasswordSubmit=passwordHasInput||busy||Boolean(error);
 async function signup(e:React.FormEvent){
  e.preventDefault();setError("");
  if(!nom.trim()||!prenom.trim()||!username.trim()||!phone.trim()||!dob||!email.trim())return setError("Veuillez remplir toutes les cases obligatoires avant de continuer.");
  if(nom.trim().length<2||!/\p{L}/u.test(nom.trim()))return setError("Le nom doit contenir au moins 2 caractères valides.");
  if(prenom.trim().length<2||!/\p{L}/u.test(prenom.trim()))return setError("Le prénom doit contenir au moins 2 caractères valides.");
  if(!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username.trim().toLowerCase()))return setError("Le nom d’utilisateur doit contenir de 3 à 30 caractères : lettres, chiffres, point, tiret ou underscore.");
  if(uState!=="available")return setError("Choisissez un nom d'utilisateur disponible.");
  if(!phoneValid)return setError("Le numéro doit contenir "+selected[4]+" chiffres pour "+selected[3]+".");
  if(age===null)return setError("Saisissez une date de naissance valide.");
  if(age<18)return setError("NAXA est réservé aux personnes âgées de 18 ans ou plus.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return setError("Saisissez une adresse e-mail valide.");
  if(!consent)return setError("Veuillez lire et accepter les conditions d’utilisation et la politique de confidentialité pour continuer.");
  setBusy(true);
  try{
    const availability=await fetch("/api/auth/signup-availability",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),phone:selected[2]+digits})});
    const available=await availability.json();
    if(!availability.ok){setBusy(false);setError(available.error||"Ces informations sont déjà utilisées.");return}
    const otpResponse=await fetch("/api/auth/signup-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),username:username.trim().toLowerCase(),first_name:prenom.trim(),last_name:nom.trim(),phone:selected[2]+digits,phone_country:selected[0],date_of_birth:dob,consent_accepted:true})});
    const otpResult=await otpResponse.json();
    setBusy(false);
    if(!otpResponse.ok){setError(otpResult.error||"Impossible d’envoyer le code de confirmation. Réessayez.");return}
    setOtpVersion(v=>v+1);setOtpSeconds(60);allerEtape("otp");
  }catch{
    setBusy(false);setError("Vérification impossible. Contrôlez votre connexion puis réessayez.");
  }
 }
  async function verifierCode(value:string){
    const token=value.trim().replace(/\s/g,"");
    if(!/^\d{6}$/.test(token)){setError("Saisissez les 6 chiffres du code reçu par e-mail.");return false}
    setBusy(true);setError("");
    try{
      // Le serveur contrôle le plafond de sessions avant de consommer le code OTP.
      const response=await fetch("/api/auth/signup-otp/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),token})});
      const result=await response.json();
      if(!response.ok){
        console.error("NAXA_SIGNUP_OTP_VERIFY_FAILED",{status:response.status});
        setError(result.error||"Code incorrect ou expiré. Vérifiez le dernier code reçu ou demandez-en un nouveau.");
        return false
      }
      return true
    }catch(error){
      console.error("NAXA_SIGNUP_OTP_VERIFY_EXCEPTION",error instanceof Error?error.message:"unknown");
      setError("Vérification impossible. Réessayez.");return false
    }finally{setBusy(false)}
  }
 async function resendOtp(){if(otpSeconds>0||resending)return;setResending(true);setError("");try{const res=await fetch("/api/auth/signup-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),username:username.trim().toLowerCase(),first_name:prenom.trim(),last_name:nom.trim(),phone:selected[2]+digits,phone_country:selected[0],date_of_birth:dob,consent_accepted:true})});const data=await res.json();if(!res.ok){setError(data.error||"Le renvoi du code a échoué. Attendez un peu et réessayez.");return}setOtpVersion(v=>v+1);setOtpSeconds(60)}catch{setError("Impossible de renvoyer le code. Vérifiez votre connexion.")}finally{setResending(false)}}
 async function savePassword(e:React.FormEvent){e.preventDefault();if(!passwordValid)return setError(password!==confirmation?"Les deux mots de passe ne correspondent pas.":"Le mot de passe doit contenir au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.");setBusy(true);setError("");const sb=supabaseBrowser();const {error}=await sb.auth.updateUser({password});if(error){setBusy(false);return setError("Impossible d’enregistrer le mot de passe.")}const {data:sessionData}=await sb.auth.getSession();const accessToken=sessionData.session?.access_token;if(!accessToken){setBusy(false);return setError("Votre inscription n’est pas terminée : aucune session valide ne permet de finaliser le compte. Recommencez la vérification.")}try{const completion=await fetch("/api/auth/complete-signup",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${accessToken}`},body:JSON.stringify({username:username.trim().toLowerCase(),first_name:prenom.trim(),last_name:nom.trim(),phone:selected[2]+digits,phone_country:selected[0],date_of_birth:dob,consent_accepted:true})});const completionResult=await completion.json();if(!completion.ok){setBusy(false);return setError(completionResult.error||"La création du compte n’est pas terminée : le profil n’a pas été finalisé. Réessayez sans quitter cette page.")}}catch{setBusy(false);return setError("La création du compte n’est pas terminée : la finalisation du profil a échoué. Réessayez.")}clearSignupDrafts();let destination=retour;if(!search.get("retour")||retour==="/"){try{const {data}=await sb.auth.getUser();if(data.user){const {data:profile}=await sb.from("profiles").select("role").eq("id",data.user.id).maybeSingle();const role=String(profile?.role||"client");const destinations:Record<string,string>={client:"/client",pharmacie:"/pharmacie",promoteur:"/pharmacie",caisse:"/pharmacie",admin:"/admin"};destination=destinations[role]||"/client"}else destination="/connexion?compteCree=1"}catch{destination="/client"}}setBusy(false);setSuccessDestination(destination)}

 if(successDestination)return <SuccesCreationCompte destination={successDestination}/>;
 return <form noValidate onSubmit={step==="details"?signup:step==="otp"?(e)=>e.preventDefault():savePassword} onInvalidCapture={(e)=>{e.preventDefault();const field=e.target as HTMLInputElement;setError(field.validity.typeMismatch?"Le format de l’adresse e-mail est invalide.":field.validity.valueMissing?"Ce champ est obligatoire.":"Vérifiez les informations saisies.")}} className={`w-full max-w-lg space-y-[10px] px-0 ${step==="otp"?"!pt-[54px]":"py-0"}`}>
  <div className={`naxa-reveal relative top-[54px] text-center ${step==="details"?"mb-[76px]":step==="password"?"mb-[44px]":""}`} style={{"--reveal-delay":"80ms"} as React.CSSProperties}>{step!=="otp"&&<><h1 className="text-[clamp(1.5rem,8vw,2.25rem)] font-extrabold text-[#064B2A]">{step==="password"?"Choisissez votre mot de passe":"Créer mon compte"}</h1><p className={`mt-1 text-xs leading-snug sm:mt-2 sm:text-sm ${step==="details"?"font-bold text-[#9B7A00]":"text-slate-600"}`}>{step==="details"?<>Renseignez vos informations pour créer votre compte <strong className="naxa-text">NAXA</strong>.</>:"Votre e-mail est validé. Choisissez maintenant votre mot de passe."}</p></>}</div>
  {step==="details"&&<><div className="grid grid-cols-2 gap-[10px]"><ChampFlottant id="signup-nom" label="Nom" className="naxa-reveal" revealDelayMs={0} value={nom} onChange={setNom} autoComplete="family-name" required valid={nom.trim().length>=2&&/\p{L}/u.test(nom.trim())} validColor="#FFE33D"/><ChampFlottant id="signup-prenom" label="Prénom" className="naxa-reveal" revealDelayMs={80} value={prenom} onChange={setPrenom} autoComplete="given-name" required valid={prenom.trim().length>=2&&/\p{L}/u.test(prenom.trim())} validColor="#FFE33D" delayMs={80}/></div>
  <div><ChampFlottant id="signup-username" label="Nom d’utilisateur" className="naxa-reveal" revealDelayMs={160} value={username} onChange={v=>setUsername(v.replace(/\s/g,""))} autoComplete="username" required maxLength={30} valid={uState==="available"} validColor="#2D9CFF" delayMs={400}/><span aria-live="polite" className={`mt-1 block min-h-[1px] text-[13px] leading-tight ${uState==="taken"?"text-red-700":"text-[#064B2A]"}`}>{uState==="checking"?"Vérification…":uState==="taken"?"Nom d’utilisateur pris ou invalide":""}</span></div>
  <div><ChampFlottant id="signup-phone" label="Numéro de téléphone" className="naxa-reveal" revealDelayMs={240} value={phone} onChange={v=>setPhone(v.replace(/\D/g,"").slice(0,selected[4]))} inputMode="numeric" autoComplete="tel-national" required valid={phoneValid} validColor="#FF9F1C" prefix={<span ref={countryPickerRef} className="relative"><button type="button" aria-haspopup="listbox" aria-expanded={countryOpen} onClick={()=>setCountryOpen(v=>!v)} className="flex min-h-8 min-w-[154px] items-center gap-1.5 rounded-full border border-[#D8E9DE] bg-white px-3 text-xs font-bold"><span>{selected[1]}</span><span>{selected[2]}</span><span aria-hidden>⌄</span></button>{countryOpen&&countryMenuPosition&&createPortal(<span ref={countryMenuRef} role="listbox" aria-label="Choisir un pays" style={{position:"fixed",left:countryMenuPosition.left,top:countryMenuPosition.top,width:countryMenuPosition.width,maxHeight:countryMenuPosition.maxHeight,zIndex:2147483647}} className="overscroll-contain overflow-y-auto rounded-2xl border border-[#D8E9DE] bg-white p-1 shadow-xl">{COUNTRIES.map(c=><button key={c[0]} type="button" role="option" aria-selected={country===c[0]} onClick={()=>{setCountry(c[0]);setPhone("");setCountryOpen(false)}} className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-slate-50"><span className="text-lg">{c[1]}</span><span className="flex-1">{c[3]}</span><span className="font-bold">{c[2]}</span></button>)}</span>,document.body)}</span>}/></div>
  <ChampFlottant id="signup-dob" label="Date de naissance" className="naxa-reveal" revealDelayMs={320} type="date" value={dob} onChange={setDob} required max={new Date().toISOString().slice(0,10)} valid={age!==null&&age>=18} validColor="#8B5CF6"/>
  {age!==null&&age<18&&<p role="alert" className="rounded-xl2 bg-red-50 p-3 text-sm font-semibold text-red-700">NAXA est réservé aux personnes âgées de 18 ans ou plus.</p>}
  <ChampFlottant id="signup-email" label="Adresse e-mail" className="naxa-reveal" revealDelayMs={400} type="email" required value={email} onChange={setEmail} autoComplete="email" valid={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)} validColor="#B3123F" delayMs={400}/>
  <label className="flex items-start gap-2 text-xs leading-snug"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#FFE33D]" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span className="flex-1">J'accepte les <Link href="/conditions-utilisation" target="_blank" rel="noopener noreferrer" className="font-bold underline text-[#9B7A00]">Conditions générales d'utilisation</Link> et la <Link href="/politique-confidentialite" target="_blank" rel="noopener noreferrer" className="font-bold underline text-[#9B7A00]">Politique de confidentialité</Link> de <strong className="naxa-text">NAXA</strong>.</span></label>
  <div aria-hidden={!showDetailsSubmit} className={`overflow-hidden transition-all duration-200 ease-out ${showDetailsSubmit?"max-h-24 translate-y-0 opacity-100":"max-h-0 -translate-y-1 opacity-0"}`}><BoutonNAXA type="submit" importance="importante" className="btn-canari w-full min-h-[52px] rounded-2xl" loading={busy} disabled={!showDetailsSubmit}>{busy?"Création...":"Valider"}</BoutonNAXA></div></>}
  {step==="otp"&&<><p className="text-center text-sm leading-snug text-[#064B2A]">Un code de confirmation a été envoyé à <strong>{email.replace(/^(.).+(@.+)$/, "$1•••$2")}</strong>.</p><CodeOtp key={otpVersion} longueur={6} verifier={verifierCode} onSucces={()=>allerEtape("password")} titre="Vérifiez votre code" description="Saisissez les 6 chiffres reçus par e-mail pour valider votre adresse." disabled={busy}/><p className="text-center text-sm leading-snug text-[#064B2A]">Vous n’avez pas reçu le code ? {otpSeconds>0?<span>Renvoyer dans {otpSeconds} s</span>:<button type="button" className="font-bold underline" disabled={resending} onClick={resendOtp}>{resending?"Envoi…":"Renvoyer le code"}</button>}</p><button type="button" className="btn btn-clair w-full" onClick={()=>{allerEtape("details");setOtpSeconds(60)}}>Modifier mes informations</button></>}
  {step==="password"&&<><ChampFlottant id="signup-password" label="Mot de passe" type={show?"text":"password"} value={password} onChange={setPassword} autoComplete="new-password" required trailing={<button type="button" className="rounded-full px-2 text-xs font-bold" onClick={()=>setShow(!show)}>{show?"Masquer":"Afficher"}</button>}/><ul aria-label={"Force du mot de passe : "+score+" critères sur 4"} className="grid grid-cols-2 gap-2 text-xs text-slate-600">{checks.map((ok,i)=><li key={i} className="flex items-center gap-2"><span aria-hidden="true" className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors ${ok?"bg-green-600 text-white":"bg-slate-200 text-slate-400"}`}>{ok?<svg viewBox="0 0 20 20" width="12" height="12" fill="none"><path d="m4.5 10.2 3.4 3.3 7.6-7.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>:null}</span><span className={ok?"font-medium text-green-700":"text-slate-500"}>{["6 caractères minimum","1 majuscule","1 chiffre","1 caractère spécial"][i]}</span></li>)}</ul><ChampFlottant id="signup-password-confirm" label="Confirmer le mot de passe" type={show?"text":"password"} value={confirmation} onChange={setConfirmation} autoComplete="new-password" required/><div aria-hidden={!showPasswordSubmit} className={`overflow-hidden transition-all duration-200 ease-out ${showPasswordSubmit?"max-h-24 translate-y-0 opacity-100":"max-h-0 -translate-y-1 opacity-0"}`}><BoutonNAXA type="submit" importance="importante" className="btn-canari w-full" loading={busy} disabled={!showPasswordSubmit}>{busy?"Enregistrement...":"Se connecter"}</BoutonNAXA></div></>}

 </form>
}
export default function CreationCompte(){return <Suspense><Formulaire/></Suspense>;}
