"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Recherche } from "@/components/Recherche";

export default function RecherchePage() {
  return <main className="mx-auto min-h-screen max-w-2xl px-4 pb-24">
    <header className="-mx-4 mb-5 flex items-center justify-between bg-naxa-green-900 px-4 py-3 text-white">
      <Link href="/"><Logo taille={32}/></Link>
      <span className="text-sm font-semibold">Recherche</span>
    </header>
    <h1 className="text-2xl font-black text-naxa-green-900">Rechercher un médicament</h1>
    <p className="mb-5 mt-2 text-sm text-slate-600">Saisissez le nom du médicament ou utilisez le scanner d’ordonnance. Comparez ensuite les stocks des pharmacies partenaires.</p>
    <Recherche langue="fr" />
  </main>;
}
