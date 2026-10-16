"use client";
import { useState,type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props={children:ReactNode;href:string;className?:string;external?:boolean;onAutorise?:()=>void|Promise<void>; "aria-hidden"?:boolean;tabIndex?:number;"aria-label"?:string};
const AGE_KEY="naxa-age-declaration-v1";
const AGE_TTL=30*24*60*60*1000;

function declarationEtat(): "adulte" | "mineur" | "absente" {
 try {
  const value=window.localStorage.getItem(AGE_KEY);
  if(!value)return "absente";
  const parsed=JSON.parse(value) as {confirmed?:boolean;at?:number};
  if(typeof parsed.at!=="number"||Date.now()-parsed.at<0||Date.now()-parsed.at>=AGE_TTL)return "absente";
  return parsed.confirmed===true?"adulte":"mineur";
 } catch { return "absente"; }
}

function memoriserDeclaration(){
 try { window.localStorage.setItem(AGE_KEY,JSON.stringify({confirmed:true,at:Date.now()})); } catch {
  // La confirmation s'applique à l'action en cours même si le stockage est indisponible.
 }
}

export function ActionProtegee({children,href,className="",external=false,onAutorise,"aria-hidden":ariaHidden,tabIndex,"aria-label":ariaLabel}:Props){
 const router=useRouter();
 const[message,setMessage]=useState<"age"|"mineur"|"connexion"|"age-compte"|null>(null);
 const[busy,setBusy]=useState(false);
 const retour=()=>window.location.pathname+window.location.search;

 async function executerAction(){
  if(busy)return;
  setBusy(true);
  try{
   const sb=supabaseBrowser();
   const{data}=await sb.auth.getUser();
   if(!data.user){setMessage("connexion");return}
   const{data:profile}=await sb.from("profiles").select("age_verified,role").eq("id",data.user.id).maybeSingle();
   if(profile?.role==="client"&&!profile.age_verified){setMessage("age-compte");return}
   if(onAutorise)await onAutorise();
   else if(external)window.location.assign(href);
   else router.push(href);
  } finally {setBusy(false)}
 }

 async function continuer(){
  if(busy)return;
  const age=declarationEtat();
  if(age==="mineur"){setMessage("mineur");return}
  if(age!=="adulte"){setMessage("age");return}
  await executerAction();
 }

 async function confirmerMajeur(){
  memoriserDeclaration();
  setMessage(null);
  await executerAction();
 }

 const titre=message==="age"?"Avant de continuer":message==="mineur"?"Accès réservé aux adultes":message==="connexion"?"Connectez-vous pour continuer":message==="age-compte"?"Votre âge doit être validé":"";
 const description=message==="age"
  ?"NAXA est destiné aux personnes âgées de 18 ans ou plus. Confirmez votre âge pour poursuivre cette action. Cette déclaration ne remplace pas la vérification demandée pour un compte client."
  :message==="mineur"
  ?"Vous avez indiqué avoir moins de 18 ans. Les actions réservées aux adultes ne sont pas accessibles. Vous pouvez fermer ce message et continuer à consulter les informations publiques."
  :message==="connexion"
  ?"Cette action nécessite un compte connecté. Après connexion, revenez à cette page et relancez l’action."
  :"Pour continuer avec votre compte, NAXA doit vérifier votre date de naissance et votre acceptation des documents.";

 return <><button type="button" className={className} onClick={continuer} disabled={busy||ariaHidden} aria-hidden={ariaHidden} tabIndex={tabIndex} aria-label={ariaLabel}>{children}</button>{message&&<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="naxa-age-title"><div className="carte w-full max-w-sm space-y-4"><h2 id="naxa-age-title" className="text-xl font-extrabold">{titre}</h2><p className="text-sm leading-relaxed text-slate-600">{description}</p>{message==="age"&&<><button type="button" className="btn btn-canari w-full" onClick={()=>void confirmerMajeur()} disabled={busy}>{busy?"Vérification…":"Je confirme avoir 18 ans ou plus"}</button><button type="button" className="btn btn-clair w-full" onClick={()=>{try{window.localStorage.setItem(AGE_KEY,JSON.stringify({confirmed:false,at:Date.now()}))}catch{}setMessage("mineur")}}>J’ai moins de 18 ans</button></>}{message==="mineur"&&<button type="button" className="btn btn-clair w-full" onClick={()=>setMessage(null)}>Fermer</button>}{message==="connexion"&&<button type="button" className="btn btn-canari w-full" onClick={()=>router.push(`/connexion?retour=${encodeURIComponent(retour())}`)}>Se connecter</button>}{message==="age-compte"&&<button type="button" className="btn btn-canari w-full" onClick={()=>router.push(`/verification-age?retour=${encodeURIComponent(retour())}`)}>Valider mon âge</button>}{message!=="mineur"&&<button type="button" className="btn btn-clair w-full" onClick={()=>setMessage(null)}>Annuler</button>}</div></div>}</>
}
