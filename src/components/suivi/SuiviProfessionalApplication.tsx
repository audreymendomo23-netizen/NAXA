"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role="medecin"|"pharmacien"|"infirmier"|"sage_femme"|"chirurgien_dentiste"|"kinesitherapeute"|"technicien_laboratoire"|"autre_sante";
type Application={
  user_id:string;professional_role:Role;display_name:string;registration_number:string|null;
  issuing_authority:string|null;specialty:string|null;credential_storage_path:string|null;
  verification_status:"pending"|"verified"|"rejected"|"expired";verification_expires_at:string|null;verified:boolean;
};
const roleLabels:Record<Role,string>={medecin:"Médecin",pharmacien:"Pharmacien",infirmier:"Infirmier",sage_femme:"Sage-femme",chirurgien_dentiste:"Chirurgien-dentiste",kinesitherapeute:"Kinésithérapeute",technicien_laboratoire:"Technicien de laboratoire",autre_sante:"Autre professionnel de santé"};

export function SuiviProfessionalApplication(){
  const sb=useMemo(()=>supabaseBrowser(),[]);
  const [userId,setUserId]=useState("");
  const [existing,setExisting]=useState<Application|null>(null);
  const [role,setRole]=useState<Role>("medecin");
  const [displayName,setDisplayName]=useState("");
  const [registration,setRegistration]=useState("");
  const [authority,setAuthority]=useState("");
  const [specialty,setSpecialty]=useState("");
  const [expiry,setExpiry]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  useEffect(()=>{void(async()=>{
    const {data}=await sb.auth.getUser();
    if(!data.user){setNotice("Connectez-vous pour soumettre une demande d'agrément.");return;}
    setUserId(data.user.id);
    const {data:row}=await sb.from("suivi_professionals").select("user_id,professional_role,display_name,registration_number,issuing_authority,specialty,credential_storage_path,verification_status,verification_expires_at,verified").eq("user_id",data.user.id).maybeSingle();
    if(row){
      const value=row as Application;
      setExisting(value);setRole(value.professional_role);setDisplayName(value.display_name);
      setRegistration(value.registration_number??"");setAuthority(value.issuing_authority??"");
      setSpecialty(value.specialty??"");setExpiry(value.verification_expires_at?.slice(0,10)??"");
    }
  })();},[sb]);
  const accreditationIsExpired=!!existing?.verification_expires_at
    && new Date(existing.verification_expires_at).getTime()<=Date.now();
  const accreditationIsCurrent=!!existing?.verified
    && existing.verification_status==="verified" && !accreditationIsExpired;
  async function submit(){
    if(!userId){setNotice("Connexion requise.");return;}
    if(accreditationIsCurrent){setNotice("Votre agrément est toujours valide. Contactez l'administration pour toute modification.");return;}
    if(displayName.trim().length<2||registration.trim().length<3||authority.trim().length<2){setNotice("Renseignez le nom, le numéro d'inscription et l'autorité émettrice.");return;}
    if(!file&&(!existing?.credential_storage_path||accreditationIsExpired)){setNotice(accreditationIsExpired?"Votre agrément est expiré : joignez un justificatif officiel renouvelé.":"Joignez le justificatif officiel d'agrément (PDF, JPG ou PNG).");return;}
    if(file&&(file.size>10*1024*1024||!["application/pdf","image/jpeg","image/png"].includes(file.type))){setNotice("Le justificatif doit être un PDF, JPG ou PNG de 10 Mo maximum.");return;}
    setBusy(true);setNotice("");
    let credentialPath=existing?.credential_storage_path??null;
    if(file){
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100);
      credentialPath=userId+"/"+crypto.randomUUID()+"-"+safeName;
      const {error:uploadError}=await sb.storage.from("suivi-accreditations").upload(credentialPath,file,{upsert:false,contentType:file.type});
      if(uploadError){setNotice("Téléversement sécurisé du justificatif impossible. Vérifiez le service de stockage.");setBusy(false);return;}
    }
    const {error}=await sb.from("suivi_professionals").upsert({
      user_id:userId,professional_role:role,display_name:displayName.trim(),
      registration_number:registration.trim(),issuing_authority:authority.trim(),
      specialty:specialty.trim()||null,credential_storage_path:credentialPath,
      verification_status:"pending",verified:false,verified_by:null,verified_at:null,
      verification_expires_at:expiry?new Date(expiry+"T23:59:59").toISOString():null
    },{onConflict:"user_id"});
    if(error){
      if(file&&credentialPath) await sb.storage.from("suivi-accreditations").remove([credentialPath]);
      setNotice("Demande non enregistrée. Votre justificatif n'a pas été conservé.");
    } else {
      if(file&&existing?.credential_storage_path&&existing.credential_storage_path!==credentialPath){
        await sb.storage.from("suivi-accreditations").remove([existing.credential_storage_path]);
      }
      setExisting({user_id:userId,professional_role:role,display_name:displayName.trim(),registration_number:registration.trim(),issuing_authority:authority.trim(),specialty:specialty.trim()||null,credential_storage_path:credentialPath,verification_status:"pending",verification_expires_at:expiry?new Date(expiry+"T23:59:59").toISOString():null,verified:false});
      setFile(null);setNotice("Demande transmise à NAXA. Votre profil ne sera visible dans l'annuaire qu'après contrôle et validation de l'accréditation.");
    }
    setBusy(false);
  }
  return <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
    <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">NAXA · Vérification professionnelle</p><h1 className="mt-1 text-2xl font-black">Demande d'agrément</h1><p className="mt-2 text-sm text-slate-600">NAXA contrôle les informations et le justificatif avant d'autoriser l'accès à l'annuaire et aux dossiers patients.</p></header>
    {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">{notice}</p>}
    {existing&&<div className="rounded-xl border p-3 text-sm"><b>État actuel :</b> {accreditationIsExpired?"Agrément expiré":existing.verification_status==="verified"?"Agrément validé":existing.verification_status==="rejected"?"Demande rejetée":existing.verification_status==="expired"?"Agrément expiré":"En attente de vérification"}</div>}
    {accreditationIsCurrent?<p className="rounded-xl bg-emerald-50 p-4 text-sm">Votre accréditation est validée par NAXA. Elle est soumise à sa date d'expiration et aux contrôles de validité continus.</p>:<>
      <div className="space-y-3 rounded-2xl border bg-white p-4">
        <label className="block text-sm font-semibold">Profession<select className="champ mt-1 w-full" value={role} onChange={e=>setRole(e.target.value as Role)}>{Object.entries(roleLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label className="block text-sm font-semibold">Nom professionnel<input className="champ mt-1 w-full" value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={160}/></label>
        <label className="block text-sm font-semibold">Numéro d'inscription / autorisation<input className="champ mt-1 w-full" value={registration} onChange={e=>setRegistration(e.target.value)} maxLength={120}/></label>
        <label className="block text-sm font-semibold">Autorité émettrice<input className="champ mt-1 w-full" value={authority} onChange={e=>setAuthority(e.target.value)} maxLength={160} placeholder="Ordre, ministère ou organisme compétent"/></label>
        <label className="block text-sm font-semibold">Spécialité<input className="champ mt-1 w-full" value={specialty} onChange={e=>setSpecialty(e.target.value)} maxLength={160}/></label>
        <label className="block text-sm font-semibold">Date d'expiration (si applicable)<input className="champ mt-1 w-full" type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
        <label className="block text-sm font-semibold">Justificatif officiel<input className="champ mt-1 w-full" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0]??null)}/><span className="mt-1 block text-xs text-slate-500">Stockage privé, accessible au déposant et aux administrateurs autorisés. 10 Mo maximum.</span></label>
        <button type="button" disabled={busy} onClick={()=>void submit()} className="min-h-11 w-full rounded-xl bg-emerald-800 px-4 font-bold text-white disabled:opacity-50">{busy?"Envoi…":"Soumettre à la vérification NAXA"}</button>
      </div>
    </>}
  </main>;
}
