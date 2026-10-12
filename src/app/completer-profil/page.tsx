"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

const COUNTRIES = [
  ["CM","+237","Cameroun",9],["AO","+244","Angola",9],["BI","+257","Burundi",8],
  ["CF","+236","Centrafrique",8],["TD","+235","Tchad",8],["CG","+242","Congo",9],
  ["CD","+243","RDC",9],["GQ","+240","Guinée équatoriale",9],["GA","+241","Gabon",8],
  ["RW","+250","Rwanda",9],["ST","+239","São Tomé-et-Príncipe",7],
] as const;

function ageOf(value: string) {
  if (!value) return null;
  const birth = new Date(value + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

function Formulaire() {
  const router = useRouter();
  const search = useSearchParams();
  const rawNext = search.get("next") || "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const [username,setUsername] = useState("");
  const [firstName,setFirstName] = useState("");
  const [lastName,setLastName] = useState("");
  const [country,setCountry] = useState("CM");
  const [phone,setPhone] = useState("");
  const [dob,setDob] = useState("");
  const [consent,setConsent] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const selected = COUNTRIES.find(c=>c[0]===country) || COUNTRIES[0];
  const age = useMemo(()=>ageOf(dob),[dob]);

  useEffect(() => {
    void (async () => {
      const sb = supabaseBrowser();
      const {data,error:authError} = await sb.auth.getUser();
      if (authError || !data.user) { router.replace("/connexion"); return; }
      const metadata = data.user.user_metadata || {};
      const fullName = String(metadata.full_name || metadata.name || "");
      const names = fullName.trim().split(/\s+/);
      setFirstName(String(metadata.given_name || metadata.first_name || names.slice(0,-1).join(" ") || ""));
      setLastName(String(metadata.family_name || metadata.last_name || names.slice(-1).join(" ") || ""));
    })();
  },[router]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username.trim().toLowerCase())) return setError("Identifiant invalide : 3 à 30 caractères.");
    if (firstName.trim().length < 2 || lastName.trim().length < 2) return setError("Renseignez votre prénom et votre nom.");
    if (phone.replace(/\D/g,"").length !== selected[3]) return setError("Le numéro ne correspond pas au pays choisi.");
    if (age === null || age < 18) return setError("NAXA est réservé aux personnes âgées de 18 ans ou plus.");
    if (!consent) return setError("Vous devez accepter explicitement les conditions.");
    setBusy(true);
    const {error:rpcError} = await supabaseBrowser().rpc("naxa_complete_google_profile",{
      p_username: username.trim().toLowerCase(),
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_phone: selected[1] + phone.replace(/\D/g,""),
      p_phone_country: selected[0],
      p_date_of_birth: dob,
      p_consent_accepted: consent,
    });
    setBusy(false);
    if (rpcError) {
      const msg = rpcError.message || "";
      setError(msg.includes("déjà pris") || msg.includes("already exists") ? "Cet identifiant est déjà utilisé." : msg.includes("18 ans") ? "NAXA est réservé aux personnes âgées de 18 ans ou plus." : "Profil non enregistré. Vérifiez les informations et réessayez.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
    <form onSubmit={submit} className="carte w-full space-y-4 p-5">
      <p className="text-sm font-semibold text-slate-500">NAXA · Sécurisation du compte</p>
      <h1 className="text-2xl font-extrabold">Complétez votre profil</h1>
      <p className="text-sm text-slate-600">Avant d’utiliser NAXA, confirmez les informations requises. Votre compte ne sera pas activé tant que l’âge et le consentement ne sont pas validés.</p>
      <label className="block text-sm font-semibold">Prénom<input className="champ mt-1" required minLength={2} maxLength={80} autoComplete="given-name" value={firstName} onChange={e=>setFirstName(e.target.value)}/></label>
      <label className="block text-sm font-semibold">Nom<input className="champ mt-1" required minLength={2} maxLength={80} autoComplete="family-name" value={lastName} onChange={e=>setLastName(e.target.value)}/></label>
      <label className="block text-sm font-semibold">Nom d'utilisateur<input className="champ mt-1" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value.replace(/\s/g,"").toLowerCase())}/><span className="mt-1 block text-xs text-slate-500">3 à 30 caractères : lettres, chiffres, point, tiret ou underscore.</span></label>
      <label className="block text-sm font-semibold">Pays<select className="champ mt-1" value={country} onChange={e=>{setCountry(e.target.value);setPhone("")}}>{COUNTRIES.map(c=><option key={c[0]} value={c[0]}>{c[2]} ({c[1]})</option>)}</select></label>
      <label className="block text-sm font-semibold">Téléphone<input className="champ mt-1" required inputMode="numeric" autoComplete="tel-national" maxLength={selected[3]} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,selected[3]))} placeholder={selected[1]+" …"}/></label>
      <label className="block text-sm font-semibold">Date de naissance<input className="champ mt-1" required type="date" max={new Date().toISOString().slice(0,10)} value={dob} onChange={e=>setDob(e.target.value)}/></label>
      {age !== null && age < 18 && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">NAXA est réservé aux personnes âgées de 18 ans ou plus.</p>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>J’accepte les <Link className="underline font-semibold" href="/conditions-utilisation" target="_blank" rel="noreferrer">Conditions d’utilisation</Link>, la <Link className="underline font-semibold" href="/politique-confidentialite" target="_blank" rel="noreferrer">Politique de confidentialité</Link> et la <Link className="underline font-semibold" href="/politique-securite" target="_blank" rel="noreferrer">Politique de sécurité</Link>.</span></label>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      <button className="btn btn-canari w-full" disabled={busy || age === null || age < 18 || !consent}>{busy ? "Vérification et enregistrement…" : "Valider et continuer"}</button>
    </form>
  </main>;
}

export default function CompleterProfilPage() {
  return <Suspense fallback={<main className="p-6">Chargement…</main>}><Formulaire/></Suspense>;
}
