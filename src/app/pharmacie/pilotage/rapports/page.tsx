"use client";

import Link from "next/link";
import RapportsALaDemande from "@/components/RapportsALaDemande";

export default function Reports() {
  return <main className="min-h-screen bg-naxa-green-50 p-3 sm:p-6">
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-naxa-green-900 p-5 text-white">
        <div><p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Rapports</p><h1 className="text-2xl font-black text-naxa-canari">Rapports & Analytics</h1></div>
        <div className="flex flex-wrap gap-2"><Link href="/pharmacie/promoteur" className="btn btn-canari">Retour à l’espace Promoteur</Link><Link href="/pharmacie/pilotage" className="btn btn-clair">Retour au pilotage</Link></div>
      </header>
      <RapportsALaDemande />
      <p className="rounded-2xl bg-white p-4 text-xs leading-5 text-slate-500">Le rapport est calculé à la demande et reste limité au périmètre que le moteur de pilotage Supabase autorise pour votre poste. Les données des autres pharmacies ou caisses ne sont pas accessibles.</p>
    </div>
  </main>;
}
