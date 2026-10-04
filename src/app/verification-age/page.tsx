"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

function Formulaire() {
  const router = useRouter();
  const retour = useSearchParams().get("retour") || "/";
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage("");
    const res = await fetch("/api/auth/verify-age", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date_of_birth:date})});
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMessage(data.error ?? "Impossible de valider votre âge.");
    router.push(retour); router.refresh();
  }

  return <form onSubmit={verifier} className="carte w-full max-w-sm space-y-4">
    <h1 className="text-2xl font-extrabold">Valider votre âge</h1>
    <p className="text-sm leading-relaxed text-slate-600">NAXA est réservé aux personnes âgées de 18 ans ou plus.</p>
    <label className="block text-sm font-semibold">Date de naissance<input className="champ mt-1" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
    <button className="btn btn-canari w-full" disabled={busy}>{busy?"Vérification...":"Valider mon âge"}</button>
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
  </form>;
}

export default function VerificationAge() {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-naxa-green-900 px-5"><Logo/><Suspense><Formulaire/></Suspense></main>;
}
