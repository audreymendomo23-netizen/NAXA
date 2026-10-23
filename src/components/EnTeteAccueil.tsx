"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { textes, type Langue } from "@/lib/accueil-textes";
import { notifierNAXA } from "@/components/NotificationGlobale";

function DrapeauFR() {
  return (
    <svg viewBox="0 0 3 2" className="h-4 w-6 shrink-0 rounded-[2px]" aria-hidden="true">
      <rect width="1" height="2" fill="#0055A4" />
      <rect x="1" width="1" height="2" fill="#FFFFFF" />
      <rect x="2" width="1" height="2" fill="#EF4135" />
    </svg>
  );
}

function DrapeauEN() {
  return (
    <svg viewBox="0 0 60 40" className="h-4 w-6 shrink-0 rounded-[2px]" aria-hidden="true">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0L60 40M60 0L0 40" stroke="#FFFFFF" strokeWidth="8" />
      <path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30 0V40M0 20H60" stroke="#FFFFFF" strokeWidth="12" />
      <path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  );
}

export function EnTeteAccueil({
  langue,
  setLangue,
}: {
  langue: Langue;
  setLangue: (langue: Langue) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const t = textes[langue];
  const universes = [
    { label: t.universPharmacie, href: "/", available: false },
    { label: t.universParapharmacie, href: "/parapharmacie", available: false },
    { label: t.universBebeMaman, href: "/bebe-maman", available: false },
    { label: t.universDispositifs, href: "/suivi", available: true },
    { label: t.universExamens, href: "/examens", available: false },
    { label: t.universPrestations, href: "/prestations", available: false },
  ];

  useEffect(() => {
    if (!ouvert) return;

    function clicExterieur(e: PointerEvent) {
      if (!conteneur.current?.contains(e.target as Node)) {
        setOuvert(false);
      }
    }

    function echap(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOuvert(false);
        bouton.current?.focus();
      }
    }

    document.addEventListener("pointerdown", clicExterieur);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", clicExterieur);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  function fermer() {
    setOuvert(false);
  }

  return (
    <header className="shrink-0 bg-naxa-green-900 px-5 pt-4 text-white">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <Logo />

        <div className="flex items-center gap-2">
          <Link href="/connexion?espace=client" className="inline-flex min-h-10 items-center justify-center rounded-full bg-naxa-canari px-3 text-xs font-extrabold text-naxa-green-900 shadow-sm transition hover:bg-naxa-canari-dark sm:px-4 sm:text-sm">
            {t.espaceClient}
          </Link>
        <div ref={conteneur} className="relative">
          <button
            ref={bouton}
            type="button"
            aria-label={ouvert ? t.fermerMenu : t.ouvrirMenu}
            aria-expanded={ouvert}
            aria-controls="menu-accueil"
            onClick={() => setOuvert((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:bg-white/10"
          >
            <span className="flex w-5 flex-col gap-1" aria-hidden="true">
              <span className={`h-0.5 w-5 rounded bg-white transition-transform duration-200 ${ouvert ? "translate-y-1.5 rotate-45" : ""}`} />
              <span className={`h-0.5 w-5 rounded bg-white transition-opacity duration-200 ${ouvert ? "opacity-0" : ""}`} />
              <span className={`h-0.5 w-5 rounded bg-white transition-transform duration-200 ${ouvert ? "-translate-y-1.5 -rotate-45" : ""}`} />
            </span>
          </button>

          {ouvert && (
            <nav
              id="menu-accueil"
              aria-label={t.menu}
              className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-naxa-green-100 bg-white p-3 text-naxa-green-900 shadow-lg"
            >
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <span className="text-sm font-semibold">{t.langue}</span>
                <div
                  role="group"
                  aria-label={t.langue}
                  className="flex rounded-full bg-naxa-canari p-1"
                >
                  {(["fr", "en"] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={langue === code}
                      aria-label={code === "fr" ? "Français" : "English"}
                      onClick={() => setLangue(code)}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-naxa-green-900 transition-colors ${
                        langue === code
                          ? "bg-white shadow-sm"
                          : "bg-transparent hover:bg-naxa-canari-dark"
                      }`}
                    >
                      {code === "fr" ? <DrapeauFR /> : <DrapeauEN />}
                      {code.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-naxa-green-100 pt-2">
                <p className="px-2 pb-1 pt-2 text-xs font-extrabold uppercase tracking-wide text-naxa-green-700">
                  {t.universSection}
                </p>
                <nav aria-label={t.universSection} className="space-y-1">
                  {universes.map((universe) => (
                    universe.available ? (
                      <Link
                        key={universe.href}
                        href={universe.href}
                        onClick={fermer}
                        className="flex min-h-11 items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold hover:bg-naxa-green-100"
                      >
                        <span>{universe.label}</span>
                        <span aria-hidden="true">›</span>
                      </Link>
                    ) : (
                      <button
                        key={universe.href}
                        type="button"
                        onClick={() => { fermer(); notifierNAXA("Cet espace n'est pas disponible actuellement"); }}
                        className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-semibold text-naxa-green-700 transition hover:bg-naxa-green-100"
                      >
                        <span>{universe.label}</span>
                        <span className="inline-flex items-center gap-2" aria-label="Espace indisponible"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span aria-hidden="true">›</span></span>
                      </button>
                    )
                  ))}
                  <button
                    type="button"
                    onClick={() => { fermer(); notifierNAXA("Cet espace n'est pas disponible actuellement"); }}
                    className="flex min-h-11 w-full items-center justify-between rounded-lg bg-red-50 px-2 py-2 text-left text-sm font-extrabold text-red-800 hover:bg-red-100"
                  >
                    <span>{t.besoinAide}</span>
                    <span className="inline-flex items-center gap-2" aria-label="Espace indisponible"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span aria-hidden="true">›</span></span>
                  </button>
                </nav>
              </div>

              <div className="border-t border-naxa-green-100 pt-2">
                <p className="px-2 pb-1 pt-2 text-xs font-extrabold uppercase tracking-wide text-naxa-green-700">
                  Services NAXA
                </p>
                <nav aria-label="Services NAXA" className="space-y-1">
                  {[
                    { label: "Parapharmacie", href: "/parapharmacie" },
                    { label: "Bébé & maman", href: "/bebe-maman" },
                    { label: "Dispositifs médicaux", href: "/suivi" },
                    { label: "Examens médicaux", href: "/examens" },
                    { label: "Soins à domicile", href: "/prestations" },
                    { label: "Besoin d’aide ?", href: "/aide" },
                  ].map((service) => (
                    <Link
                      key={service.href}
                      href={service.href}
                      onClick={fermer}
                      className="flex min-h-11 items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold hover:bg-naxa-green-100"
                    >
                      <span>{service.label}</span>
                      <span aria-hidden="true">›</span>
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="border-t border-naxa-green-100 pt-2">
                <Link
                  href="/connexion?espace=client"
                  onClick={fermer}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-naxa-green-100"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6" />
                  </svg>
                  {t.espaceClient}
                </Link>

                <Link
                  href="/connexion?espace=pharmacie"
                  onClick={fermer}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-naxa-green-100"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M12 7v10M7 12h10" />
                  </svg>
                  {t.espacePharmacie}
                </Link>
              </div>
            </nav>
          )}
        </div>
        </div>
      </div>

      <h1 className="mx-auto mt-4 max-w-xl text-[clamp(1.7rem,5.5dvh,2.5rem)] font-extrabold leading-[1.1]">
        {t.titreLigne1}
        <br />
        <span className="text-naxa-canari">{t.titreLigne2}</span>
      </h1>

      <svg
        viewBox="0 0 340 40"
        preserveAspectRatio="none"
        className="mt-3 block h-8 w-full"
        aria-hidden="true"
      >
        <path
          d="M0 40 L0 22 Q85 0 170 18 T340 10 L340 40 Z"
          className="fill-naxa-green-50"
        />
      </svg>
    </header>
  );
}
