"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ECOSYSTEMES,
  enregistrerEcosystemeSelectionne,
  ecosystemeDepuisChemin,
  type EcosystemeId,
} from "@/lib/ecosystemes";

const englishLabels: Record<EcosystemeId, string> = {
  pharmacie: "Pharmacy",
  parapharmacie: "Parapharmacy",
  examens: "Medical tests",
  prestations: "Home care",
  "bebe-maman": "Mom & Baby",
  dispositifs: "Medical devices",
};

export function MenuUnivers() {
  const pathname = usePathname();
  const currentEcosystem = ecosystemeDepuisChemin(pathname);
  const [availability, setAvailability] = useState<Record<string, boolean>>({ pharmacie: true });
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/universes/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("universe_status");
        return response.json() as Promise<{ universes?: Record<string, boolean> }>;
      })
      .then((result) => {
        if (active) setAvailability({ pharmacie: true, ...(result.universes ?? {}) });
      })
      .catch(() => {
        if (active) setAvailability({ pharmacie: true });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const syncLanguage = () => {
      try {
        setLanguage(window.localStorage.getItem("naxa-langue") === "en" ? "en" : "fr");
      } catch {
        setLanguage(document.documentElement.lang === "en" ? "en" : "fr");
      }
    };
    syncLanguage();
    window.addEventListener("naxa-language-updated", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("naxa-language-updated", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);

  const t = language === "en"
    ? { open: "Open universe menu", close: "Close universe menu", title: "Explore NAXA spaces" }
    : { open: "Ouvrir le menu des univers", close: "Fermer le menu des univers", title: "Explorer les univers NAXA" };

  return (
    <div ref={root} className="relative z-40">
      <button
        ref={button}
        type="button"
        aria-label={open ? t.close : t.open}
        aria-expanded={open}
        aria-controls="menu-univers-naxa"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[#064B2A]/20 bg-white text-[#064B2A] shadow-sm transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#064B2A]"
      >
        <span className="flex flex-col items-center gap-1" aria-hidden="true">
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </span>
      </button>
      {open && (
        <nav id="menu-univers-naxa" aria-label={t.title} className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-emerald-100 bg-white p-2 text-[#064B2A] shadow-xl">
          <p className="px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-emerald-800">{t.title}</p>
          {ECOSYSTEMES.filter((universe) => universe.id !== currentEcosystem).map((universe) => {
            const enabled = availability[universe.id] === true;
            const label = language === "en" ? englishLabels[universe.id] : universe.label;
            return enabled ? (
              <Link
                key={universe.id}
                href={universe.href}
                onClick={() => {
                  setOpen(false);
                  enregistrerEcosystemeSelectionne(universe.id);
                }}
                className="flex min-h-11 items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#064B2A]"
              >
                <span>{label}</span><span aria-hidden="true">›</span>
              </Link>
            ) : (
              <div key={universe.id} aria-disabled="true" className="flex min-h-11 items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-slate-400">
                <span>{label}</span><span aria-label="Verrouillé" title="Verrouillé">🔒</span>
              </div>
            );
          })}
        </nav>
      )}
    </div>
  );
}
