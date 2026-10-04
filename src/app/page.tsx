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

const DICTIONNAIRE: Record<string, string> = {
  "Se connecter": "Sign in",
  "Votre médicament,": "Your medicine,",
  "à 2 minutes.": "just 2 minutes away.",
  "Je cherche": "I search",
  "Je trouve": "I find",
  "Je compare": "I compare",
  "Je réserve": "I reserve",
  "NAXA donne une information de disponibilité, pas un avis médical. En cas d'urgence contactez les secours au numéros 117 118 et 119, ou rendez-vous à la pharmacie la plus proche.": "NAXA provides availability information, not medical advice. In an emergency, call 117, 118 or 119, or go to the nearest pharmacy.",
  "Vous êtes une Pharmacie ?": "Are you a pharmacy?",
  "Made With 💚": "Made With 💚",
};

const TERMES_MEDICAUX: Record<string, string> = {
  "paracétamol": "paracetamol",
  "ibuprofène": "ibuprofen",
  "amoxicilline": "amoxicillin",
  "acide clavulanique": "clavulanic acid",
  "azithromycine": "azithromycin",
  "métronidazole": "metronidazole",
  "artéméther": "artemether",
  "luméfantrine": "lumefantrine",
  "ceftriaxone": "ceftriaxone",
  "ciprofloxacine": "ciprofloxacin",
  "doxycycline": "doxycycline",
  "diclofénac": "diclofenac",
  "oméprazole": "omeprazole",
  "cétirizine": "cetirizine",
  "aspirine": "aspirin",
  "metformine": "metformin",
  "insuline": "insulin",
  "comprimé": "tablet",
  "gélule": "capsule",
  "sirop": "syrup",
  "solution buvable": "oral solution",
  "suspension buvable": "oral suspension",
  "crème": "cream",
  "pommade": "ointment",
  "gel": "gel",
  "collyre": "eye drops",
  "injection": "injection",
  "comprimé dispersible": "dispersible tablet",
  "comprimé effervescent": "effervescent tablet",
  "voie orale": "oral route",
  "voie intraveineuse": "intravenous (IV)",
  "voie intramusculaire": "intramuscular (IM)",
  "voie sous-cutanée": "subcutaneous (SC)",
  "posologie": "dosage / dose regimen",
  "dose": "dose",
  "dose quotidienne": "daily dose",
  "contre-indication": "contraindication",
  "effets indésirables": "adverse effects / side effects",
  "effet indésirable": "adverse effect / side effect",
  "ordonnance": "prescription",
  "pharmacien": "pharmacist",
  "pharmacie": "pharmacy",
  "en stock": "in stock",
  "rupture de stock": "out of stock",
};

function traduireInterface(texte: string, langue: Langue) {
  if (langue === "fr") {
    const entree = Object.entries(DICTIONNAIRE).find(([, en]) => en === texte);
    return entree?.[0] ?? texte;
  }
  return DICTIONNAIRE[texte] ?? texte;
}

function traduireMedicament(nom: string, langue: Langue) {
  if (langue === "fr") return nom;
  return nom.replace(/paracétamol/gi, "paracetamol")
    .replace(/ibuprofène/gi, "ibuprofen")
    .replace(/amoxicilline/gi, "amoxicillin")
    .replace(/acide clavulanique/gi, "clavulanic acid")
    .replace(/azithromycine/gi, "azithromycin")
    .replace(/métronidazole/gi, "metronidazole")
    .replace(/artéméther/gi, "artemether")
    .replace(/luméfantrine/gi, "lumefantrine")
    .replace(/ceftriaxone/gi, "ceftriaxone")
    .replace(/ciprofloxacine/gi, "ciprofloxacin")
    .replace(/doxycycline/gi, "doxycycline")
    .replace(/diclofénac/gi, "diclofenac")
    .replace(/oméprazole/gi, "omeprazole")
    .replace(/cétirizine/gi, "cetirizine")
    .replace(/aspirine/gi, "aspirin")
    .replace(/metformine/gi, "metformin")
    .replace(/insuline/gi, "insulin");
}

function variantesRechercheMedicament(nom: string) {
  const variantes = new Set([nom.trim()]);
  const normalise = nom.toLowerCase().trim();
  if (normalise.includes("paracétamol")) variantes.add(nom.replace(/paracétamol/gi, "paracetamol"));
  if (normalise.includes("acetaminophen") || normalise.includes("paracetamol")) {
    variantes.add(nom.replace(/acetaminophen/gi, "paracetamol"));
    variantes.add(nom.replace(/paracetamol/gi, "acetaminophen"));
    variantes.add(nom.replace(/paracétamol/gi, "acetaminophen"));
  }
  return [...variantes];
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
    document.documentElement.lang = langue;
  }, [langue]);

  return (
    <main className="home-ecran flex flex-col bg-naxa-green-50">
      <section className="shrink-0 bg-naxa-green-900 px-5 pt-4 text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Logo />
          <Link href="/connexion" className="text-sm font-semibold text-naxa-canari underline underline-offset-4">
            {traduireInterface("Se connecter", langue)}
          </Link>
        </div>
        <h1 className="mx-auto mt-4 max-w-xl text-[clamp(1.7rem,5.5dvh,2.5rem)] font-extrabold leading-[1.1]">
          {traduireInterface("Votre médicament,", langue)}<br />
          <span className="text-naxa-canari">{traduireInterface("à 2 minutes.", langue)}</span>
        </h1>
        <svg viewBox="0 0 340 40" preserveAspectRatio="none" className="mt-3 block h-8 w-full" aria-hidden="true">
          <path d="M0 40 L0 22 Q85 0 170 18 T340 10 L340 40 Z" className="fill-naxa-green-50" />
        </svg>
      </section>

      <div className="relative z-10 mx-auto -mt-5 w-full max-w-xl shrink-0 px-4">
        <div className="carte"><Recherche langue={langue} /></div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-3 px-4 py-2">
        <ol className="grid grid-cols-4 gap-2 [@media(max-height:600px)]:hidden">
          {ETAPES[langue].map((etape, i) => (
            <li key={etape} className="flex flex-col items-center gap-1 text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-naxa-canari text-sm font-extrabold text-naxa-green-900">{i + 1}</span>
              <span className="text-xs font-semibold">{etape}</span>
            </li>
          ))}
        </ol>
        <p className="mt-auto text-xs leading-relaxed text-slate-600">
          {langue === "fr" ? (
            <>NAXA donne une information de disponibilité, pas un avis médical. En cas d'urgence contactez les secours au numéros <a className="font-bold underline" href="tel:117">117</a> <a className="font-bold underline" href="tel:118">118</a> et <a className="font-bold underline" href="tel:119">119</a>, ou rendez-vous à la pharmacie la plus proche.</>
          ) : (
            <>NAXA provides availability information, not medical advice. In an emergency, call <a className="font-bold underline" href="tel:117">117</a>, <a className="font-bold underline" href="tel:118">118</a> or <a className="font-bold underline" href="tel:119">119</a>, or go to the nearest pharmacy.</>
          )}
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl shrink-0 px-4 pb-2">
        <div className="flex justify-start">
          <a href={"https://wa.me/237681972237?text=" + encodeURIComponent("Hello team NAXA\nJe souhaite échanger avec vous.")} target="_blank" rel="noreferrer" className="btn btn-canari min-h-[40px] px-4 text-xs">
            {traduireInterface("Vous êtes une Pharmacie ?", langue)}
          </a>
        </div>
      </div>

      <div className="shrink-0 bg-white px-5 py-1 text-xs text-slate-600">
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className="col-start-2 text-center font-semibold">{traduireInterface("Made With 💚", langue)}</span>
          <div className="flex justify-end gap-1" role="group" aria-label="Language">
            <button type="button" onClick={() => setLangue("fr")} className={langue === "fr" ? "font-bold text-naxa-green-900" : "font-medium text-slate-500"} aria-pressed={langue === "fr"}>Fr</button>
            <span aria-hidden="true">|</span>
            <button type="button" onClick={() => setLangue("en")} className={langue === "en" ? "font-bold text-naxa-green-900" : "font-medium text-slate-500"} aria-pressed={langue === "en"}>En</button>
          </div>
        </div>
      </div>
    </main>
  );
}
