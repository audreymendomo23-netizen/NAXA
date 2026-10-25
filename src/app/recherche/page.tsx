"use client";

import { IllustrationPageClient } from "@/components/IllustrationPageClient";
import { Recherche } from "@/components/Recherche";

export default function RecherchePage() {
  return <main className="mx-auto min-h-screen max-w-2xl px-4 pb-24">
    <IllustrationPageClient src="/couvertures/recherche.webp" alt="Illustration de la recherche de produits" titre="Recherche de produits" />
    <h1 className="text-2xl font-black text-naxa-green-900">Rechercher un médicament</h1>
    <p className="mb-5 mt-2 text-sm text-slate-600">Saisissez le nom du médicament ou utilisez le scanner d’ordonnance. Comparez ensuite les stocks des pharmacies partenaires.</p>
    <Recherche langue="fr" />
  </main>;
}
