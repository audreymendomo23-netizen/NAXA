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
  const [ageGate, setAgeGate] = useState<"required" | "minor" | null>("required");

  function ageStatus(): "adult" | "minor" | "missing" {
    try {
      const raw = window.localStorage.getItem("naxa-home-age-declaration-v1");
      if (!raw) return "missing";
      const declaration = JSON.parse(raw) as { confirmed?: boolean; at?: number };
      if (typeof declaration.at !== "number" || Date.now() - declaration.at < 0 || Date.now() - declaration.at >= 30 * 24 * 60 * 60 * 1000) return "missing";
      return declaration.confirmed === true ? "adult" : "minor";
    } catch { return "missing"; }
  }

  function enregistrerCookieAge(confirmed: boolean) {
    // Le middleware utilise ce cookie pour bloquer aussi les accès directs aux autres pages.
    document.cookie = `naxa-age-status-v2=${confirmed ? "adult" : "minor"}; Max-Age=2592000; Path=/; SameSite=Lax`;
  }

  function destinationApresAge(): string | null {
    try {
      const raw = new URLSearchParams(window.location.search).get("retourAge");
      if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
      const destination = new URL(raw, window.location.origin);
      if (destination.origin !== window.location.origin) return null;
      return destination.pathname + destination.search + destination.hash;
    } catch {
      return null;
    }
  }

  function declarerAge(confirmed: boolean) {
    try { window.localStorage.setItem("naxa-home-age-declaration-v1", JSON.stringify({ confirmed, at: Date.now() })); } catch { /* La déclaration reste valable pour cette visite. */ }
    enregistrerCookieAge(confirmed);
    if (confirmed) {
      const destination = destinationApresAge();
      if (destination) {
        window.location.replace(destination);
        return;
      }
    }
    setAgeGate(confirmed ? null : "minor");
    if (confirmed) setIntroVisible(true);
  }

  useEffect(() => {
    let actif = true;
    const key = "naxa-intro-seen-v1";

    // Afficher immédiatement le contrôle d'âge, sans attendre la réponse Supabase.
    // La déclaration d'accueil est indépendante de celles demandées pour les actions.
    const ageInitial = ageStatus();
    const destination = destinationApresAge();
    if (ageInitial === "adult" && destination) {
      enregistrerCookieAge(true);
      window.location.replace(destination);
      return () => { actif = false; };
    }
    setAgeGate(ageInitial === "adult" ? null : ageInitial === "minor" ? "minor" : "required");
    setIntroVisible(false);

    const sb = supabaseBrowser();

    const redirigerClientConnecte = async (userId: string) => {
      // Un client connecté doit retrouver son accueil client, pas l'accueil public.
      // Respecter le contrôle d'âge avant toute redirection vers une page protégée.
      if (ageStatus() !== "adult" || window.location.pathname !== "/") return;
      const { data: profile, error } = await sb
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (actif && !error && profile?.role === "client" && window.location.pathname === "/") {
        window.location.replace("/client");
      }
    };

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (!actif) return;
      if (session) {
        setIntroVisible(false);
        void redirigerClientConnecte(session.user.id);
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
      if (age === "adult") enregistrerCookieAge(true);
      if (age === "minor") enregistrerCookieAge(false);
      if (age === "missing") {
        setAgeGate("required");
        setIntroVisible(false);
        return;
      }
      if (age === "minor") {
        setAgeGate("minor");
        setIntroVisible(false);
        return;
      }
      setAgeGate(null);
      if (session) {
        setIntroVisible(false);
        void redirigerClientConnecte(session.user.id);
        return;
      }
      try {
        if (window.sessionStorage.getItem(key) === "1") {
          setIntroVisible(false);
          return;
        }
        window.sessionStorage.setItem(key, "1");
      } catch {
        // En cas de stockage indisponible, privilégier l'accès à l'accueil.
      }
      setIntroVisible(true);
    }).catch(() => {
      if (actif) {
        const age = ageStatus();
        setAgeGate(age === "adult" ? null : age === "minor" ? "minor" : "required");
        setIntroVisible(false);
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
    <main>
      <EnTeteAccueil langue={langue} setLangue={setLangue} />

      <div className="relative z-10 mx-auto -mt-5 w-full max-w-xl shrink-0 px-4">
        <section aria-label="Recherche publique" className="rounded-3xl border border-[#DDF3E6] bg-white p-4 shadow-[0_14px_40px_rgba(6,75,42,0.09)] sm:p-5">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E5F5EB] text-[#064B2A]" aria-hidden="true"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></span>
            <div><h2 className="font-extrabold text-[#064B2A]">Que recherchez-vous ?</h2><p className="mt-0.5 text-xs leading-5 text-slate-500">Médicaments, pharmacies et pharmacies de garde.</p></div>
          </div>
          <Recherche langue={langue} />
        </section>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={localiser}
            disabled={position === "recherche"}
            className={puce}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
              <circle cx="12" cy="10" r="2.3" />
            </svg>
            {t.presDeMoi}
          </button>
          <Link href="/gardes" className={puce}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
            </svg>
            {t.gardes}
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
            <a className={lienPied} href="tel:117">Police 117</a>
            <a className={lienPied} href="tel:118">Pompiers 118</a>
            <a className={lienPied} href="tel:119">SAMU 119</a>
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
