"use client";
import { useState } from "react";
import { PROMOTEUR_VALIDATION, type PromoteurPhoneCountry, validatePromoteurPhone } from "@/lib/promoteur-validation";
import { MotDePasseVisible } from "@/components/admin/MotDePasseVisible";

type Props = { className: string; errors?: Record<string,string> };
const countries = Object.entries(PROMOTEUR_VALIDATION.phone) as [PromoteurPhoneCountry, (typeof PROMOTEUR_VALIDATION.phone)[PromoteurPhoneCountry]][];
export function IdentificationPromoteur({className,errors={}}:Props) {
 const [country,setCountry]=useState<PromoteurPhoneCountry>("CM");
 const [values,setValues]=useState<Record<string,string>>({});
 const [touched,setTouched]=useState<Record<string,boolean>>({});
 const set=(k:string,v:string)=>setValues(p=>({...p,[k]:v}));
 const validate=(k:string,v=values[k]??"")=>{
  if(k==="first_name"||k==="last_name") return v.trim().length<2||v.trim().length>80?"2 à 80 caractères attendus":undefined;
  if(k==="username") return PROMOTEUR_VALIDATION.username.test(v.toLowerCase())?undefined:"3 à 30 caractères : lettres, chiffres, point, tiret ou underscore.";
  if(k==="email") return PROMOTEUR_VALIDATION.email.test(v.trim())?undefined:"Adresse e-mail invalide.";
  if(k==="phone_number") return validatePromoteurPhone(v,country);
  if(k==="date_of_birth") return !/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v).getTime()>Date.now()?"Date de naissance invalide.":undefined;
  if(k==="motdepasse") return v.length<PROMOTEUR_VALIDATION.passwordMinLength?"6 caractères minimum":undefined;
  return undefined;
 };
 const field=(key:string,label:string,placeholder?:string,type="text",help?:string,pattern?:string)=>{const error=(touched[key]?validate(key):undefined)||errors[key];return <label key={key} className="block text-sm font-semibold">{label}<input name={key} type={type} required value={values[key]??""} placeholder={placeholder} pattern={pattern} onChange={e=>set(key,e.target.value)} onBlur={()=>setTouched(p=>({...p,[key]:true}))} aria-invalid={!!error} className={className+" "+(error?"border-red-600 focus:ring-red-600":"")}/>{help&&<span className={"mt-1 block text-xs "+(error?"text-red-600":"text-slate-500")}>{error||help}</span>}{error&&<span className="sr-only">{error}</span>}</label>};
 return <div className="space-y-3">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{field("last_name","Nom")}{field("first_name","Prénom")}</div>
  {field("username","Nom d’utilisateur",undefined,"text","3 à 30 caractères : lettres, chiffres, point, tiret ou underscore.")}
  <label className="block text-sm font-semibold">Téléphone<div className="mt-1 flex gap-2"><select aria-label="Indicatif téléphonique" value={country} onChange={e=>setCountry(e.target.value as PromoteurPhoneCountry)} className={className+" w-36 shrink-0"}>{countries.map(([code,c])=><option key={code} value={code}>{c.flag} {c.dial}</option>)}</select><input name="phone_number" required type="tel" inputMode="numeric" value={values.phone_number??""} onChange={e=>set("phone_number",e.target.value)} onBlur={()=>setTouched(p=>({...p,phone_number:true}))} placeholder="612345678" aria-invalid={!!((touched.phone_number&&validate("phone_number"))||errors.phone)} className={className+" min-w-0 flex-1 "+(((touched.phone_number&&validate("phone_number"))||errors.phone)?"border-red-600":"")}/><input type="hidden" name="phone_country" value={country}/></div><span className={"mt-1 block text-xs "+(((touched.phone_number&&validate("phone_number"))||errors.phone)?"text-red-600":"text-slate-500")}>{((touched.phone_number&&validate("phone_number"))||errors.phone)||`${PROMOTEUR_VALIDATION.phone[country].digits} chiffres attendus`}</span></label>
  {field("date_of_birth","Date de naissance",undefined,"date","Vous devez avoir au moins 18 ans.")}
  {field("email","E-mail",undefined,"email","Adresse utilisée pour le compte.")}
  <label className="block text-sm font-semibold">Mot de passe provisoire<MotDePasseVisible className={className}/><span className="mt-1 block text-xs text-slate-500">6 caractères minimum</span></label>
 </div>;
}
