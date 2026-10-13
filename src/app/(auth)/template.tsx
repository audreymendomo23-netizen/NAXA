"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const { direction } = useAuthFlow();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const stepLabel = useMemo(() => {
    if (pathname === "/creation-compte") return "Créer mon compte";
    if (pathname === "/mot-de-passe-oublie") return "Mot de passe oublié";
    if (pathname === "/nouveau-mot-de-passe") return "Créer un nouveau mot de passe";
    if (search.get("espace") === "pharmacie") return search.get("etape") === "identifiants" ? "Identifiants de connexion pharmacie" : "Code pharmacie";
    return "Connexion";
  }, [pathname, search]);
  useEffect(() => {
    const title = contentRef.current?.querySelector<HTMLElement>("h1");
    if (title) {
      if (!title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1");
      title.focus({ preventScroll: true });
    } else {
      contentRef.current?.querySelector<HTMLElement>("input:not([type=hidden])")?.focus({ preventScroll: true });
    }
  }, [pathname, search]);
  return <div ref={contentRef} className={`auth-stage auth-stage-${direction}`}>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{stepLabel}</p>
    {children}
  </div>;
}
