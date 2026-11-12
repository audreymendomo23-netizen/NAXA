"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SuiviProfessionalWorkspaceShell({children}:{children:ReactNode}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function logout(){
    if(busy)return;
    setBusy(true);setError("");
    const {error:signOutError}=await supabaseBrowser().auth.signOut();
    setBusy(false);
    if(signOutError){setError("Déconnexion impossible. Réessayez.");return;}
    router.replace("/connexion");
  }
  return <main className="min-h-screen bg-[#F4F8F5] px-3 pb-10 pt-3 sm:px-4 sm:pt-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
      <header className="rounded-2xl bg-[#123D68] p-4 text-white shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-widest text-blue-100">NAXA · Espace professionnel de santé</p><h1 className="mt-1 text-xl font-black sm:text-2xl">Suivi connecté des patients</h1><p className="mt-1 text-sm text-blue-100">Dossiers autorisés, mesures, historiques et alertes.</p></div>
          <button type="button" onClick={()=>void logout()} disabled={busy} className="min-h-10 rounded-xl border border-white/40 px-4 text-sm font-bold disabled:opacity-50">{busy?"Déconnexion…":"Déconnexion"}</button>
        </div>
        <nav aria-label="Navigation professionnel de santé" className="mt-4 flex flex-wrap gap-2">
          <Link href="/suivi/professionnel/patients" className="min-h-10 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#123D68]">Patients suivis</Link>
          <Link href="/suivi/professionnel/demande" className="min-h-10 rounded-xl border border-white/40 px-3 py-2 text-sm font-bold text-white">Mon accréditation</Link>
          <Link href="/suivi" className="min-h-10 rounded-xl border border-white/40 px-3 py-2 text-sm font-bold text-white">Retour NAXA</Link>
        </nav>
        {error&&<p role="alert" className="mt-2 text-sm text-red-100">{error}</p>}
      </header>
      {children}
    </div>
  </main>;
}
