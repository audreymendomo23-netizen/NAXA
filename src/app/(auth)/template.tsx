"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuthFlow } from "@/components/auth/AuthFlowContext";

export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const { direction } = useAuthFlow();
  const query = search.toString();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const stepLabel = useMemo(() => {
    if (pathname === "/creation-compte") return "Créer mon compte";
    if (pathname === "/mot-de-passe-oublie") return "Mot de passe oublié";
    if (pathname === "/nouveau-mot-de-passe") return "Créer un nouveau mot de passe";
    if (new URLSearchParams(query).get("espace") === "pharmacie") {
      if (new URLSearchParams(query).get("panneau") === "mot-de-passe") return "Mettre à jour le mot de passe";
      return new URLSearchParams(query).get("etape") === "identifiants" ? "Identifiants de connexion pharmacie" : "Code pharmacie";
    }
    return "Connexion";
  }, [pathname, query]);
  useEffect(() => {
    let attempts = 0;
    let frame = 0;
    const focusStep = () => {
      const title = contentRef.current?.querySelector<HTMLElement>("h1");
      const target = title ?? contentRef.current?.querySelector<HTMLElement>("input:not([type=hidden])");
      if (target) {
        if (title && !title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        return;
      }
      if (attempts++ < 8) frame = window.requestAnimationFrame(focusStep);
    };
    frame = window.requestAnimationFrame(focusStep);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, query]);
  return <div ref={contentRef} className={`auth-stage auth-stage-${direction}`}>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{stepLabel}</p>
    {children}
  </div>;
}
