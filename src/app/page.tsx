"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { EnTeteAccueil } from "@/components/EnTeteAccueil";
import { Recherche } from "@/components/Recherche";
import { BoutonNAXA } from "@/components/BoutonNAXA";
import { BulleErreur } from "@/components/BulleErreur";
import {
  recherchesFrequentes,
  textes,
  type Langue,
} from "@/lib/accueil-textes";

type EtatPosition = "inconnue" | "recherche" | "active" | "defaut";

const puce =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-naxa-green-100 bg-white px-3 text-sm font-semibold text-naxa-green-900 hover:bg-naxa-green-100";

const lienPied =
  "inline-flex min-h-11 items-center underline underline-offset-2 hover:text-naxa-canari-dark";

function Svg({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
function IconeRecherche() { return <Svg><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Svg>; }
function IconeTrouve() { return <Svg><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></Svg>; }
function IconeCompare() { return <Svg><path d="M4 8h15M15 4l4 4-4 4" /><path d="M20 16H5M9 12l-4 4 4 4" /></Svg>; }
function IconeReserve() { return <Svg><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8 3v4M16 3v4" /></Svg>; }
const iconesEtapes = [IconeRecherche, IconeTrouve, IconeCompare, IconeReserve];


export default function Accueil() {
  const [langue, setLangue] = useState<Langue>("fr");
  const langueInitialisee = useRef(false);
  const [position, setPosition] = useState<EtatPosition>("inconnue");
  const t = textes[langue];
  const etapesAccueil = langue === "fr" ? ["Rechercher", "Trouver", "Comparer", "Réserver"] : ["Search", "Find", "Compare", "Reserve"];

  useEffect(() => {
    try {
      const sauvegardee = window.localStorage.getItem("naxa-langue");
      if (sauvegardee === "fr" || sauvegardee === "en") {
        setLangue(sauvegardee);
      } else if (window.navigator.language?.toLowerCase().startsWith("en")) {
        setLangue("en");
      }
    } catch {
      // La page reste utilisable si le stockage local est indisponible.
    } finally {
      langueInitialisee.current = true;
    }
  }, []);

  useEffect(() => {
    if (!langueInitialisee.current) return;
    try {
      window.localStorage.setItem("naxa-langue", langue);
    } catch {
      // La langue reste active pendant la session.
    }
    document.documentElement.lang = langue;
  }, [langue]);

  function localiser() {
    if (!navigator.geolocation) {
      setPosition("defaut");
      return;
    }
    setPosition("recherche");
    navigator.geolocation.getCurrentPosition(
      () => setPosition("active"),
      () => setPosition("defaut"),
      { maximumAge: 300000, timeout: 8000 }
    );
  }

  const messagePosition =
    position === "active"
      ? t.positionEnregistree
      : position === "defaut"
        ? t.yaoundeDefaut
        : position === "recherche"
          ? t.localisationEnCours
          : null;

  return (
    <main
      className="home-ecran flex flex-col bg-white"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      <EnTeteAccueil langue={langue} setLangue={setLangue} />

      <div className="relative z-10 mx-auto -mt-5 w-full max-w-xl shrink-0 px-4">
        <div className="carte">
          <Recherche langue={langue} />
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <BoutonNAXA
            type="button"
            importance="importante"
            onClick={localiser}
            disabled={position === "recherche"}
            className={puce}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
              <circle cx="12" cy="10" r="2.3" />
            </svg>
            {t.presDeMoi}
          </BoutonNAXA>
          <Link href="/gardes" className={puce}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
            </svg>
            {t.gardes}
          </Link>
        </div>

        {messagePosition && <BulleErreur message={messagePosition} />}

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-naxa-green-900">
            {t.recherchesFrequentes}
          </h2>
          <div className="flex flex-wrap gap-2">
            {recherchesFrequentes.map((item) => (
              <Link
                key={item.fr}
                href={`/resultats?q=${encodeURIComponent(item.fr)}`}
                className={puce}
              >
                {item[langue]}
              </Link>
            ))}
          </div>
        </section>

        <ol className="mt-3 flex items-start justify-between gap-1 [@media(max-height:600px)]:hidden">
          {etapesAccueil.map((etape, i) => {
            const Icone = iconesEtapes[i];
            return (
              <Fragment key={etape}>
                <li className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center text-naxa-green-900">
                  <Icone />
                  <span className="text-xs font-semibold">{etape}</span>
                </li>
                {i < etapesAccueil.length - 1 && (
                  <li aria-hidden="true" className="shrink-0 pt-1.5 text-naxa-green-700">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      </div>

      <footer className="mt-auto w-full shrink-0 bg-naxa-green-900 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 text-naxa-canari">
        <div className="mx-auto flex max-w-xl flex-col gap-1 text-xs">
          <p>{t.avertissement}</p>
          <div className="flex flex-wrap items-center gap-x-4">
            <a className={lienPied} href="tel:117">117</a>
            <a className={lienPied} href="tel:118">118</a>
            <a className={lienPied} href="tel:119">119</a>
            <a
              className={lienPied}
              href={
                "https://wa.me/237681972237?text=" +
                encodeURIComponent(langue === "fr" ? "Bonjour NAXA, je suis pharmacien(ne) et je souhaite rejoindre NAXA. Pouvez-vous me contacter ?" : "Hello NAXA, I am a pharmacist and would like to join NAXA. Could you contact me?")
              }
              target="_blank"
              rel="noreferrer"
            >
              {t.pharmacienCta}
            </a>
          </div>
          <p className="pt-1 text-center font-semibold">{t.builtWith}</p>
        </div>
      </footer>
    </main>
  );
}
