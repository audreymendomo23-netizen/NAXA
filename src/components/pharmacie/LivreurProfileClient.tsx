"use client";

import Link from "next/link";
import {useState,type FormEvent} from "react";
import {supabaseBrowser} from "@/lib/supabase/client";
import {EspaceNaxaSwitcher} from "@/components/EspaceNaxaSwitcher";
import {verifierSecuriteMotDePasse} from "@/lib/auth/password-security-client";

type Profile={id:string;first_name:string|null;last_name:string|null;username:string|null;phone:string|null;age_verified:boolean;actif:boolean;created_at:string|null};
type Assignment={id:string;pharmacie_id:string;pharmacy_name:string|null;statut:string;nature_affectation:string;motif:string|null;commence_at:string;expire_at:string|null;revoque_at:string|null};
type Props={profile:Profile;email:string;activePharmacyName:string|null;assignments:Assignment[];assignmentsError:boolean};

const dateLabel=(value:string|null)=>{
  if(!value)return "Sans date de fin";
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?"Date indisponible":parsed.toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});
};
const assignmentStatus=(item:Assignment)=>{
  if(item.statut==="revoked"||item.revoque_at)return "Révoquée";
  const now=Date.now();
  if(new Date(item.commence_at).getTime()>now)return "À venir";
  if(item.expire_at&&new Date(item.expire_at).getTime()<=now)return "Expirée";
  return "Active";
};
const initials=(profile:Profile)=>{
  const name=[profile.first_name,profile.last_name].filter(Boolean).join(" ").trim();
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]?.toLocaleUpperCase("fr-FR")??"").join("")||"L";
};

export function LivreurProfileClient({profile:initialProfile,email,activePharmacyName,assignments,assignmentsError}:Props){
  const [profile,setProfile]=useState(initialProfile);
  const [saving,setSaving]=useState(false);
  const [profileMessage,setProfileMessage]=useState("");
  const [profileError,setProfileError]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [passwordBusy,setPasswordBusy]=useState(false);
  const [passwordMessage,setPasswordMessage]=useState("");
  const [passwordError,setPasswordError]=useState("");
  const [logoutBusy,setLogoutBusy]=useState(false);
  const activeAssignments=assignments.filter(item=>assignmentStatus(item)==="Active");
  const fullName=[profile.first_name,profile.last_name].filter(Boolean).join(" ")||"Livreur NAXA";

  async function saveProfile(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(saving)return;
    setSaving(true);setProfileMessage("");setProfileError("");
    const firstName=profile.first_name?.trim()??"";
    const lastName=profile.last_name?.trim()??"";
    const username=profile.username?.trim().toLowerCase()??"";
    const phone=profile.phone?.trim()??"";
    if(!firstName||!lastName){setProfileError("Le prénom et le nom sont obligatoires.");setSaving(false);return;}
    if(!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)){
      setProfileError("L’identifiant doit contenir 3 à 30 caractères : lettres minuscules, chiffres, point, tiret ou soulignement.");
      setSaving(false);return;
    }
    if(!/^[+]?[0-9\s().-]{8,24}$/.test(phone)){
      setProfileError("Saisissez un numéro de téléphone valide avec son indicatif si nécessaire.");
      setSaving(false);return;
    }
    try{
      const sb=supabaseBrowser();
      const {data:auth,error:authError}=await sb.auth.getUser();
      if(authError||!auth.user||auth.user.id!==profile.id){
        setProfileError("Session invalide. Reconnectez-vous avant de modifier votre profil.");return;
      }
      const {data:updated,error:updateError}=await sb.from("profiles").update({
        first_name:firstName,last_name:lastName,username,phone,
      }).eq("id",auth.user.id).select("id").maybeSingle();
      if(updateError||updated?.id!==auth.user.id){
        setProfileError(updateError?.code==="23505"
          ?"Cet identifiant est déjà utilisé. Choisissez-en un autre."
          :"Le profil n’a pas été modifié. Vérifiez les informations puis réessayez.");
        return;
      }
      setProfile(current=>({...current,first_name:firstName,last_name:lastName,username,phone}));
      setProfileMessage("Vos informations ont été enregistrées.");
    }catch{
      setProfileError("Enregistrement impossible pour le moment. Vérifiez votre connexion.");
    }finally{setSaving(false);}
  }

  async function changePassword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(passwordBusy)return;
    setPasswordMessage("");setPasswordError("");
    const valid=newPassword.length>=6&&/[A-Z]/.test(newPassword)&&/[0-9]/.test(newPassword)&&/[^A-Za-z0-9]/.test(newPassword);
    if(!valid){setPasswordError("Le mot de passe doit contenir au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.");return;}
    if(newPassword!==confirmation){setPasswordError("Les deux mots de passe ne correspondent pas.");return;}
    setPasswordBusy(true);
    try{
      const security=await verifierSecuriteMotDePasse(newPassword);
      if(!security.ok){setPasswordError(security.message);return;}
      const {data:auth,error:authError}=await supabaseBrowser().auth.getUser();
      if(authError||!auth.user||auth.user.id!==profile.id){setPasswordError("Session invalide. Reconnectez-vous puis réessayez.");return;}
      const {error:updateError}=await supabaseBrowser().auth.updateUser({password:newPassword});
      if(updateError){setPasswordError("Le mot de passe n’a pas pu être modifié. Reconnectez-vous puis réessayez.");return;}
      setNewPassword("");setConfirmation("");setPasswordMessage("Mot de passe mis à jour.");
    }catch{
      setPasswordError("La vérification de sécurité est momentanément indisponible.");
    }finally{setPasswordBusy(false);}
  }

  async function logout(){
    if(logoutBusy)return;
    setLogoutBusy(true);
    const {error}=await supabaseBrowser().auth.signOut();
    if(error){setLogoutBusy(false);setProfileError("La déconnexion n’a pas pu être confirmée. Réessayez.");return;}
    window.location.assign("/connexion");
  }

  return <main className="min-h-dvh bg-[#F4F8F5] px-4 pb-16 pt-5 text-slate-900">
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-5 text-white">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Espace professionnel</p><h1 className="mt-1 text-2xl font-black">Mon profil Livreur</h1><p className="mt-1 text-sm text-emerald-100">Identité, affectations et sécurité de votre compte.</p></div>
        <div className="flex flex-wrap items-center gap-2"><EspaceNaxaSwitcher current="livreur"/><Link href="/pharmacie/livreur" className="min-h-10 rounded-xl border border-white/30 px-3 py-2 text-sm font-bold">Retour aux missions</Link></div>
      </header>

      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#0B3D26] text-xl font-black text-white">{initials(profile)}</div>
          <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Profil professionnel dédié</p><h2 className="mt-1 break-words text-xl font-black">{fullName}</h2><p className="mt-1 text-sm text-slate-600">@{profile.username??"Identifiant non renseigné"}</p></div>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-950">{profile.actif?"Compte actif":"Compte suspendu"}</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Espace actuellement sélectionné</p><p className="mt-1 font-bold">{activePharmacyName??"Pharmacie non déterminée"}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Affectations Livreur actives</p><p className="mt-1 font-bold">{activeAssignments.length} pharmacie(s)</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">Informations personnelles</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Mettez à jour vos coordonnées. Votre rôle Livreur, vos droits professionnels et vos affectations ne peuvent pas être modifiés depuis ce formulaire.</p>
        <form onSubmit={saveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Prénom<input required autoComplete="given-name" maxLength={100} value={profile.first_name??""} onChange={event=>setProfile(current=>({...current,first_name:event.target.value}))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"/></label>
          <label className="text-sm font-semibold text-slate-700">Nom<input required autoComplete="family-name" maxLength={100} value={profile.last_name??""} onChange={event=>setProfile(current=>({...current,last_name:event.target.value}))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"/></label>
          <label className="text-sm font-semibold text-slate-700">Nom d’utilisateur<input required autoComplete="username" minLength={3} maxLength={30} value={profile.username??""} onChange={event=>setProfile(current=>({...current,username:event.target.value.toLowerCase()}))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"/></label>
          <label className="text-sm font-semibold text-slate-700">Téléphone<input required autoComplete="tel" inputMode="tel" maxLength={24} value={profile.phone??""} onChange={event=>setProfile(current=>({...current,phone:event.target.value}))} placeholder="+237 6 XX XX XX XX" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"/></label>
          {profileError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900 sm:col-span-2">{profileError}</p>}
          {profileMessage&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950 sm:col-span-2">{profileMessage}</p>}
          <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-[#0B3D26] px-5 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{saving?"Enregistrement…":"Enregistrer mes informations"}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">Sécurité et accès</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">E-mail de connexion</p><p className="mt-1 break-all font-semibold">{email||"Non disponible"}</p><p className="mt-1 text-xs text-slate-500">L’adresse e-mail est affichée en lecture seule.</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vérification du compte</p><p className="mt-1 font-semibold">{profile.age_verified?"Identité majeure vérifiée":"Vérification à compléter"}</p><p className="mt-1 text-xs text-slate-500">L’âge et le statut du compte sont contrôlés par NAXA.</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compte créé le</p><p className="mt-1 font-semibold">{dateLabel(profile.created_at)}</p></div>
        </div>
        <form onSubmit={changePassword} className="mt-5 space-y-3 border-t pt-5">
          <div><h3 className="font-bold">Changer le mot de passe</h3><p className="mt-1 text-sm text-slate-600">Le nouveau mot de passe est contrôlé par le mécanisme de sécurité NAXA, notamment la vérification des mots de passe compromis.</p></div>
          <label className="block text-sm font-semibold text-slate-700">Nouveau mot de passe
            <span className="mt-1 flex gap-2"><input required autoComplete="new-password" type={showPassword?"text":"password"} value={newPassword} onChange={event=>setNewPassword(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2"/><button type="button" onClick={()=>setShowPassword(value=>!value)} className="min-h-11 rounded-xl border px-3 text-xs font-bold">{showPassword?"Masquer":"Afficher"}</button></span>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Confirmer le nouveau mot de passe<input required autoComplete="new-password" type={showPassword?"text":"password"} value={confirmation} onChange={event=>setConfirmation(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2"/></label>
          {passwordError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{passwordError}</p>}
          {passwordMessage&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">{passwordMessage}</p>}
          <button type="submit" disabled={passwordBusy} className="min-h-11 rounded-xl border border-emerald-900/30 px-5 py-3 text-sm font-bold text-emerald-950 disabled:opacity-50">{passwordBusy?"Vérification…":"Mettre à jour le mot de passe"}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-extrabold">Mes affectations Livreur</h2><p className="mt-1 text-sm text-slate-600">Vos affectations peuvent couvrir plusieurs pharmacies. Une seule pharmacie est sélectionnée comme espace actif à la fois.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-950">{activeAssignments.length} active(s)</span></div>
        {assignmentsError?<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">La liste des affectations n’a pas pu être chargée. Vos droits et votre compte restent inchangés.</p>
          :assignments.length===0?<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune affectation Livreur n’est associée à ce compte.</p>
          :<div className="mt-4 space-y-3">{assignments.map(item=>{
            const status=assignmentStatus(item);
            return <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{item.pharmacy_name??"Pharmacie associée"}</h3><p className="mt-1 text-xs text-slate-500">{item.nature_affectation==="urgence"?"Permanence temporaire":"Affectation dédiée"}</p></div><span className={status==="Active"?"rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-950":"rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"}>{status}</span></div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Début</dt><dd className="font-medium">{dateLabel(item.commence_at)}</dd></div><div><dt className="text-xs text-slate-500">Fin</dt><dd className="font-medium">{dateLabel(item.expire_at)}</dd></div>{item.motif&&<div className="sm:col-span-2"><dt className="text-xs text-slate-500">Motif</dt><dd className="font-medium">{item.motif}</dd></div>}</dl>
            </article>;
          })}</div>}
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">Fermer la session</h2><p className="mt-1 text-sm text-slate-600">La déconnexion termine votre session sur cet appareil. Elle ne révoque pas vos affectations Livreur.</p>
        <button type="button" onClick={()=>void logout()} disabled={logoutBusy} className="mt-4 min-h-11 rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{logoutBusy?"Déconnexion…":"Se déconnecter"}</button>
      </section>
      <Link href="/pharmacie/livreur" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">← Retour au tableau de bord Livreur</Link>
    </div>
  </main>;
}
