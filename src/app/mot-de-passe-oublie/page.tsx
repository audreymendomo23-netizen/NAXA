"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";

function Formulaire() {
  const router = useRouter();
  const retour = useSearchParams().get("retour") || "/";
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    setBusy(false);
    setMessage(data.message ?? "Si ce nom d'utilisateur existe, un e-mail de récupération a été envoyé.");
  }

  return <form onSubmit={envoyer} className="carte w-full max-w-sm space-y-4">
    <h1 className="text-2xl font-extrabold">Mot de passe oublié</h1>
    <p className="text-sm leading-relaxed text-slate-600">Saisissez votre nom d'utilisateur. Si le compte existe, NAXA vous enverra un e-mail de récupération.</p>
    <label className="block text-sm font-semibold">Nom d'utilisateur
      <input className="champ mt-1" required value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username"/>
    </label>
    <button className="btn btn-canari w-full" disabled={busy}>{busy ? "Envoi..." : "Recevoir le lien"}</button>
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    <p className="text-center text-sm"><button type="button" onClick={()=>router.push(`/connexion?retour=${encodeURIComponent(retour)}`)} className="font-bold underline">Retour à la connexion</button></p>
    <p className="text-center text-xs text-slate-500">Le message ne révèle pas si un compte existe.</p>
    <Link href="/" className="block text-center text-sm underline">Retour à l'accueil</Link>
  </form>;
}

export default function MotDePasseOublie() {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-naxa-green-900 px-5"><Logo/><Suspense><Formulaire/></Suspense></main>;
}
