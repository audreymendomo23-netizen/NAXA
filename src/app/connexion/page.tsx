"use client";
import { Suspense,useState } from "react";
import Link from "next/link";
import { useRouter,useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

function Formulaire(){
 const router=useRouter(), search=useSearchParams(), retour=search.get("retour")||"/";
 const [username,setUsername]=useState(""),[password,setPassword]=useState(""),[show,setShow]=useState(false),[remember,setRemember]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});const d=await r.json();setBusy(false);if(!r.ok){setError(d.error||"Identifiants incorrects.");return}localStorage.setItem("naxa-remember",remember?"1":"0");router.push(retour);router.refresh()}
 async function google(){setError("");const {error}=await supabaseBrowser().auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(retour)}`}});if(error)setError("La connexion Google est momentanément indisponible.")}
 return <form onSubmit={login} className="carte w-full max-w-sm space-y-4">
  <h1 className="text-2xl font-extrabold">Se connecter</h1>
  <label className="block text-sm font-semibold">Nom d'utilisateur<input className="champ mt-1" required value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} autoComplete="username"/></label>
  <label className="block text-sm font-semibold">Mot de passe<span className="relative mt-1 block"><input className="champ pr-20" required type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-xs font-bold" onClick={()=>setShow(!show)}>{show?"Masquer":"Afficher"}</button></span></label>
  <div className="flex items-center justify-between gap-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#FFE33D]" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Rester connecté</label><Link href={`/mot-de-passe-oublie?retour=${encodeURIComponent(retour)}`} className="font-semibold underline">Mot de passe oublié ?</Link></div>
  <button className="btn btn-canari w-full" disabled={busy}>{busy?"Connexion...":"Connexion"}</button>
  <div className="relative py-1 text-center text-xs text-slate-500"><span className="bg-white px-2">ou</span></div>
  <button type="button" onClick={google} className="btn btn-clair w-full">Connexion via Gmail</button>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  <p className="text-center text-sm text-slate-600">Vous n'avez pas de compte ? <Link href={`/creation-compte?retour=${encodeURIComponent(retour)}`} className="font-bold underline">Créer un compte</Link></p>
 </form>
}
export default function Connexion(){return <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-naxa-green-900 px-5"><Logo/><Suspense><Formulaire/></Suspense></main>}
