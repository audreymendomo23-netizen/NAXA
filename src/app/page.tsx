"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { EnTeteAccueil } from "@/components/EnTeteAccueil";
import { IntroNaxa } from "@/components/IntroNaxa";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Recherche } from "@/components/Recherche";
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
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconeRecherche() {
  return (
    <Svg>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </Svg>
  );
}

function IconeTrouve() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </Svg>
  );
}

function IconeCompare() {
  return (
    <Svg>
      <path d="M4 8h15M15 4l4 4-4 4" />
      <path d="M20 16H5M9 12l-4 4 4 4" />
    </Svg>
  );
}

function IconeReserve() {
  return (
    <Svg>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </Svg>
  );
}

const iconesEtapes = [IconeRecherche, IconeTrouve, IconeCompare, IconeReserve];

export default function Accueil() {
  const [langue, setLangue] = useState<Langue>("fr");
  const [introVisible, setIntroVisible] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [ageGate, setAgeGate] = useState<"required" | "minor" | null>(null);

  function ageStatus(): "adult" | "minor" | "missing" {
    try {
      const raw = window.localStorage.getItem("naxa-age-declaration-v1");
      if (!raw) return "missing";
      const declaration = JSON.parse(raw) as { confirmed?: boolean; at?: number };
      if (typeof declaration.at !== "number" || Date.now() - declaration.at < 0 || Date.now() - declaration.at >= 30 * 24 * 60 * 60 * 1000) return "missing";
      return declaration.confirmed === true ? "adult" : "minor";
    } catch { return "missing"; }
  }

  function declarerAge(confirmed: boolean) {
    try { window.localStorage.setItem("naxa-age-declaration-v1", JSON.stringify({ confirmed, at: Date.now() })); } catch { /* La déclaration reste valable pour cette visite. */ }
    setAgeGate(confirmed ? null : "minor");
    if (confirmed) setIntroVisible(true);
  }

  useEffect(() => {
    let actif = true;
    const key = "naxa-intro-seen-v1";
    const sb = supabaseBrowser();

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (!actif) return;
      if (session) {
        setIntroVisible(false);
        setIntroReady(true);
        return;
      }
      if (event === "SIGNED_OUT") {
        try {
          window.sessionStorage.removeItem(key);
        } catch {
          // La session reste déconnectée même si le stockage est indisponible.
        }
      }
    });

    void sb.auth.getSession().then(({ data: { session } }) => {
      if (!actif) return;
      const age = ageStatus();
      if (age === "missing") {
        setAgeGate("required");
        setIntroVisible(false);
        setIntroReady(true);
        return;
      }
      if (age === "minor") {
        setAgeGate("minor");
        setIntroVisible(false);
        setIntroReady(true);
        return;
      }
      setAgeGate(null);
      if (session) {
        setIntroVisible(false);
        setIntroReady(true);
        return;
      }
      try {
        if (window.sessionStorage.getItem(key) === "1") {
          setIntroVisible(false);
          setIntroReady(true);
          return;
        }
        window.sessionStorage.setItem(key, "1");
      } catch {
        // En cas de stockage indisponible, privilégier l'accès à l'accueil.
      }
      setIntroVisible(true);
      setIntroReady(true);
    }).catch(() => {
      if (actif) {
        const age = ageStatus();
        setAgeGate(age === "adult" ? null : age === "minor" ? "minor" : "required");
        setIntroVisible(false);
        setIntroReady(true);
      }
    });

    return () => {
      actif = false;
      subscription.unsubscribe();
    };
  }, []);
  const langueInitialisee = useRef(false);
  const [position, setPosition] = useState<EtatPosition>("inconnue");
  const t = textes[langue];

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
    <>
    <main className="home-ecran flex flex-col bg-[#F2FAF5]">
      <EnTeteAccueil langue={langue} setLangue={setLangue} />

      <section className="relative z-10 mx-auto -mt-5 w-full max-w-xl shrink-0 px-4" aria-label="Recherche publique">
        <div className="overflow-hidden rounded-[1.75rem] border border-[#D6EEDF] bg-white shadow-[0_18px_50px_rgba(6,75,42,0.13)]">
          <div className="bg-gradient-to-br from-[#FFFFFF] via-[#F5FCF7] to-[#E5F5EB] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#DDF3E6] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#064B2A]">
                <span className="h-2 w-2 rounded-full bg-[#0A6B3A]" aria-hidden="true" /> Recherche publique
              </span>
              <span className="text-xs font-semibold text-[#557364]">Yaoundé · Cameroun</span>
            </div>
            <h2 className="max-w-sm text-2xl font-extrabold leading-tight tracking-tight text-[#064B2A] sm:text-3xl">Trouvez votre médicament sans perdre de temps.</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Comparez les pharmacies, consultez les disponibilités publiées et repérez les pharmacies de garde autour de vous.</p>
            <div className="mt-5 rounded-2xl border border-[#D6EEDF] bg-white p-3 shadow-sm sm:p-4">
              <Recherche langue={langue} />
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#557364]">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
              La recherche est libre. Pour contacter une pharmacie ou effectuer une réservation, connectez-vous ou créez un compte.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={localiser} disabled={position === "recherche"} className="group flex min-h-[108px] flex-col items-start justify-between rounded-2xl border border-[#D6EEDF] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#9ACDAE] hover:shadow-md disabled:opacity-70">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5F5EB] text-[#064B2A]" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>
            </span>
            <span><span className="block text-sm font-extrabold text-[#064B2A]">{t.presDeMoi}</span><span className="mt-1 block text-xs text-slate-500">Repérer les pharmacies proches</span></span>
          </button>
          <Link href="/gardes" className="group flex min-h-[108px] flex-col items-start justify-between rounded-2xl border border-[#D6EEDF] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9ACDAE] hover:shadow-md">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4B8] text-[#064B2A]" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>
            </span>
            <span><span className="block text-sm font-extrabold text-[#064B2A]">{t.gardes}</span><span className="mt-1 block text-xs text-slate-500">Voir les gardes publiées</span></span>
          </Link>
        </div>

        <p className="min-h-4 text-xs text-slate-600" aria-live="polite">
          {messagePosition}
        </p>

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
          {t.etapes.map((etape, i) => {
            const Icone = iconesEtapes[i];
            return (
              <Fragment key={etape}>
                <li className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center text-naxa-green-900">
                  <Icone />
                  <span className="text-xs font-semibold">{etape}</span>
                </li>
                {i < t.etapes.length - 1 && (
                  <li aria-hidden="true" className="shrink-0 pt-1.5 text-naxa-green-700">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      </div>

      <footer className="mt-2 w-full shrink-0 bg-naxa-green-900 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 text-naxa-canari">
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
                encodeURIComponent("Hello team NAXA\nJe souhaite échanger avec vous.")
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
    {!introReady && <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 2147483646, background: "#064B2A" }} />}
    {ageGate && <div className="fixed inset-0 z-[2147483645] flex items-center justify-center bg-[#064B2A] p-4" role="dialog" aria-modal="true" aria-labelledby="naxa-age-gate-title">
      <section className="w-full max-w-md rounded-3xl border border-white/15 bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F2FAF5] text-[#064B2A]" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.3 2.3 4.8-5"/></svg>
        </div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0A6B3A]">NAXA · Santé & proximité</p>
        <h2 id="naxa-age-gate-title" className="mt-2 text-2xl font-extrabold leading-tight text-[#064B2A]">{ageGate === "minor" ? "Accès non autorisé" : "Avant d’accéder à NAXA"}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{ageGate === "minor" ? "Vous avez déclaré avoir moins de 18 ans. L’accès à NAXA est bloqué. Cette décision est mémorisée sur cet appareil pendant 30 jours." : "NAXA est destiné aux personnes âgées de 18 ans ou plus. Confirmez votre âge pour accéder à la recherche publique de médicaments et de pharmacies."}</p>
        {ageGate === "required" && <div className="mt-6 grid gap-3">
          <button type="button" className="btn btn-canari w-full" onClick={() => declarerAge(true)}>J’ai 18 ans ou plus</button>
          <button type="button" className="btn btn-clair w-full" onClick={() => declarerAge(false)}>J’ai moins de 18 ans</button>
        </div>}
        {ageGate === "minor" && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">La recherche publique et les actions de la plateforme ne sont pas accessibles après cette déclaration.</p>}
        <p className="mt-5 text-xs leading-5 text-slate-500">Cette déclaration est une indication fournie par l’utilisateur et ne constitue pas, à elle seule, une vérification d’identité ou d’âge.</p>
      </section>
    </div>}
    {introVisible && !ageGate && <IntroNaxa onFinish={() => setIntroVisible(false)} />}
    </>
  );
}
