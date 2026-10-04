"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Recherche } from "@/components/Recherche";

type Langue = "fr" | "en";

const ETAPES = {
  fr: ["Je cherche", "Je trouve", "Je compare", "Je réserve"],
  en: ["I search", "I find", "I compare", "I reserve"],
};

const TRADUCTIONS: Record<string, string> = {
  "Se connecter": "Sign in",
  "Votre médicament,": "Your medicine,",
  "à 2 minutes.": "in 2 minutes.",
  "Je cherche": "I search",
  "Je trouve": "I find",
  "Je compare": "I compare",
  "Je réserve": "I reserve",
  "NAXA donne une information de disponibilité, pas un avis médical. En cas d'urgence, appelez les secours ou allez à la pharmacie de garde la plus proche.": "NAXA provides availability information, not medical advice. In an emergency, call emergency services or go to the nearest on-duty pharmacy.",
  "NAXA, partout au Cameroun": "NAXA, across Cameroon",
  "Vous êtes pharmacien ?": "Are you a pharmacist?",
  "Ex. Paracétamol 500mg": "E.g. Paracetamol 500mg",
  "Médicament recherché": "Medicine searched",
  "Chercher": "Search",
  "Scanner mon ordonnance": "Scan my prescription",
  "Lecture de l'ordonnance…": "Reading prescription…",
  "La lecture a échoué. Prenez la photo bien à plat, avec de la lumière, ou tapez le nom du médicament.": "Reading failed. Take the photo flat in good light, or type the medicine name.",
  "Vérifiez les médicaments lus": "Check the medicines read",
  "Fiabilité de la lecture :": "Reading confidence:",
  "Elle est faible : corrigez ou supprimez les lignes erronées. Seul le pharmacien confirme le médicament.": "It is low: correct or remove incorrect lines. Only the pharmacist confirms the medicine.",
  "Ajouter une ligne": "Add a line",
  "Annuler": "Cancel",
  "Chercher en stock": "Search stock",
  "Supprimer cette ligne": "Delete this line",
};

const FR_VALUES = new Set(Object.keys(TRADUCTIONS));

function traduireTexte(texte: string, langue: Langue) {
  if (langue === "fr") {
    for (const [en, fr] of Object.entries(TRADUCTIONS)) {
      if (FR_VALUES.has(en) && texte === fr) return en;
    }
    return texte;
  }

  if (TRADUCTIONS[texte]) return TRADUCTIONS[texte];

  for (const [fr, en] of Object.entries(TRADUCTIONS)) {
    if (texte === en) return fr;
  }

  return texte;
}

function appliquerLangue(langue: Langue) {
  document.documentElement.lang = langue;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) continue;

    const original = node.nodeValue ?? "";
    const trimmed = original.trim();
    if (!trimmed) continue;

    const traduit = traduireTexte(trimmed, langue);
    if (traduit !== trimmed) {
      node.nodeValue = original.replace(trimmed, traduit);
    }
  }

  document.querySelectorAll<HTMLInputElement>("input[placeholder], input[aria-label], button[aria-label], [role='dialog'][aria-label]").forEach((element) => {
    for (const attribute of ["placeholder", "aria-label"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const traduit = traduireTexte(value, langue);
      if (traduit !== value) element.setAttribute(attribute, traduit);
    }
  });
}

export default function Accueil() {
  const [langue, setLangue] = useState<Langue>("fr");
  const langueInitialisee = useRef(false);

  useEffect(() => {
    const sauvegardee = window.localStorage.getItem("naxa-langue");
    if (sauvegardee === "fr" || sauvegardee === "en") setLangue(sauvegardee);
    langueInitialisee.current = true;
  }, []);

  useEffect(() => {
    if (!langueInitialisee.current) return;

    window.localStorage.setItem("naxa-langue", langue);
    appliquerLangue(langue);

    const observer = new MutationObserver(() => appliquerLangue(langue));
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [langue]);

  return (
    <main className="home-ecran flex flex-col bg-naxa-green-50">
      <section className="shrink-0 bg-naxa-green-900 px-5 pt-4 text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Logo />
          <Link href="/connexion" className="text-sm font-semibold underline underline-offset-4">
            {langue === "fr" ? "Se connecter" : "Sign in"}
          </Link>
        </div>
        <h1 className="mx-auto mt-4 max-w-xl text-[clamp(1.7rem,5.5dvh,2.5rem)] font-extrabold leading-[1.1]">
          {langue === "fr" ? "Votre médicament," : "Your medicine,"}<br />
          <span className="text-naxa-canari">{langue === "fr" ? "à 2 minutes." : "in 2 minutes."}</span>
        </h1>
        <svg viewBox="0 0 340 40" preserveAspectRatio="none" className="mt-3 block h-8 w-full" aria-hidden="true">
          <path d="M0 40 L0 22 Q85 0 170 18 T340 10 L340 40 Z" className="fill-naxa-green-50" />
        </svg>
      </section>

      <div className="relative z-10 mx-auto -mt-5 w-full max-w-xl shrink-0 px-4">
        <div className="carte"><Recherche /></div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col justify-center gap-3 px-4 py-2">
        <ol className="grid grid-cols-4 gap-2 [@media(max-height:600px)]:hidden">
          {ETAPES[langue].map((t, i) => (
            <li key={t} className="flex flex-col items-center gap-1 text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-naxa-canari text-sm font-extrabold text-naxa-green-900">{i + 1}</span>
              <span className="text-xs font-semibold">{t}</span>
            </li>
          ))}
        </ol>
        <p className="text-[11px] leading-snug text-slate-600">
          {langue === "fr"
            ? "NAXA donne une information de disponibilité, pas un avis médical. En cas d'urgence, appelez les secours ou allez à la pharmacie de garde la plus proche."
            : "NAXA provides availability information, not medical advice. In an emergency, call emergency services or go to the nearest on-duty pharmacy."}
        </p>
      </div>

      <div className="shrink-0 bg-white px-5 py-3 text-xs text-slate-600">
        <div className="mx-auto grid max-w-xl grid-cols-3 items-center gap-3">
          <span />
          <span className="text-center font-semibold">Made With 💚</span>
          <div className="flex justify-end gap-1" role="group" aria-label="Language">
            <button
              type="button"
              onClick={() => setLangue("fr")}
              className={langue === "fr" ? "font-bold text-naxa-green-900" : "font-medium text-slate-500"}
              aria-pressed={langue === "fr"}
            >
              Fr
            </button>
            <span aria-hidden="true">|</span>
            <button
              type="button"
              onClick={() => setLangue("en")}
              className={langue === "en" ? "font-bold text-naxa-green-900" : "font-medium text-slate-500"}
              aria-pressed={langue === "en"}
            >
              En
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
