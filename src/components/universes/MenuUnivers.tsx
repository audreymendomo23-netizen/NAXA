"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const universes = [
  { label: "Pharmacie", href: "/" },
  { label: "Parapharmacie", href: "/parapharmacie" },
  { label: "Bébé & maman", href: "/bebe-maman" },
  { label: "Dispositifs médicaux", href: "/suivi" },
  { label: "Examens médicaux", href: "/examens" },
  { label: "Prestations et soins à domicile", href: "/prestations" },
  { label: "Besoin d’aide ?", href: "/aide" },
];

export function MenuUnivers() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

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

  return (
    <div ref={root} className="relative z-40">
      <button
        ref={button}
        type="button"
        aria-label={open ? "Fermer le menu des univers" : "Ouvrir le menu des univers"}
        aria-expanded={open}
        aria-controls="menu-univers-naxa"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[#064B2A]/20 bg-white text-[#064B2A] shadow-sm transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#064B2A]"
      >
        <span className="flex w-5 flex-col gap-1" aria-hidden="true">
          <span className={`h-0.5 w-5 rounded bg-current transition-transform ${open ? "translate-y-1.5 rotate-45" : ""}`} />
          <span className={`h-0.5 w-5 rounded bg-current transition-opacity ${open ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-5 rounded bg-current transition-transform ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
        </span>
      </button>
      {open && (
        <nav id="menu-univers-naxa" aria-label="Explorer les univers NAXA" className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-emerald-100 bg-white p-2 text-[#064B2A] shadow-xl">
          <p className="px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-emerald-800">Explorer les univers NAXA</p>
          {universes.map((universe) => (
            <Link key={universe.href} href={universe.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#064B2A]">
              <span>{universe.label}</span><span aria-hidden="true">›</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
