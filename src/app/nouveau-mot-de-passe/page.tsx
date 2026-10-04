"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

function forceValidPassword(value: string) {
  return value.length >= 6 && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export default function NouveauMotDePasse() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "INITIAL_SESSION") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!forceValidPassword(password)) return setMessage("Le mot de passe doit contenir au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.");
    if (password !== confirmation) return setMessage("Les deux mots de passe ne correspondent pas.");
    setMessage("");
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    if (error) return setMessage("Impossible de modifier le mot de passe. Le lien est peut-être expiré.");
    router.push("/connexion");
  }

  const score = [password.length >= 6, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;

  return <main className="auth-ecran flex flex-col items-center justify-center gap-6 bg-naxa-green-900 px-5 py-2"><Logo/><form onSubmit={submit} className="carte w-full max-w-sm space-y-4">
    <h1 className="text-2xl font-extrabold">Créer un nouveau mot de passe</h1>
    {!ready && <p className="text-sm text-slate-600">Vérification du lien en cours...</p>}
    <label className="block text-sm font-semibold">Mot de passe
      <span className="relative mt-1 block"><input className="champ pr-12" required type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-sm">{show?"Masquer":"Afficher"}</button></span>
    </label>
    <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-naxa-canari transition-all" style={{width:`${score*25}%`}}/></div>
    <p className="text-xs text-slate-500">6 caractères minimum · 1 majuscule · 1 chiffre · 1 caractère spécial</p>
    <label className="block text-sm font-semibold">Confirmer le mot de passe<input className="champ mt-1" required type={show?"text":"password"} value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password"/></label>
    <button className="btn btn-canari w-full" disabled={!ready}>Enregistrer</button>
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
  </form></main>;
}
