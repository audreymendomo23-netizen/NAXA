"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";

const POLITIQUES=[
  ["/conditions-utilisation","Conditions d'utilisation"],
  ["/politique-confidentialite","Politique de confidentialité"],
  ["/politique-securite","Politique de sécurité et de protection des données"],
] as const;

function Formulaire() {
  const router = useRouter();
  const retour = useSearchParams().get("retour") || "/";
  const [date, setDate] = useState("");
  const [accepted,setAccepted]=useState([false,false,false]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const allAccepted=accepted.every(Boolean);

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    if(!allAccepted){setMessage("Veuillez lire et accepter les trois documents avant de continuer.");return}
    setBusy(true); setMessage("");
    const res = await fetch("/api/auth/verify-age", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date_of_birth:date,policiesAccepted:accepted})});
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMessage(data.error ?? "Impossible de valider votre âge.");
    router.push(retour); router.refresh();
  }

  return <form onSubmit={verifier} className="carte w-full max-w-sm space-y-3">
    <h1 className="text-2xl font-extrabold">Valider votre âge</h1>
    <p className="text-sm leading-relaxed text-slate-600">NAXA est réservé aux personnes âgées de 18 ans ou plus. Avant de valider, veuillez prendre connaissance des documents suivants.</p>
    <div className="space-y-2 rounded-xl2 bg-naxa-green-50 p-3">
      {POLITIQUES.map(([href,label],i)=><label key={href} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#FFE33D]" checked={accepted[i]} onChange={e=>setAccepted(v=>v.map((x,j)=>j===i?e.target.checked:x))} required/><span>J'ai lu et j'accepte les <Link href={href} target="_blank" className="font-bold underline">{label}</Link>.</span></label>)}
    </div>
    <label className="block text-sm font-semibold">Date de naissance<input className="champ mt-1" type="date" required value={date} onChange={e=>setDate(e.target.value)} max={new Date().toISOString().slice(0,10)}/></label>
    <button className="btn btn-canari w-full" disabled={busy||!allAccepted}>{busy?"Vérification...":"Valider mon âge"}</button>
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
  </form>;
}

export default function VerificationAge() {
  return <main className="auth-ecran flex flex-col items-center justify-center gap-3 bg-naxa-green-900 px-5 py-2"><Logo/><Suspense><Formulaire/></Suspense></main>;
}
