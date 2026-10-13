"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function TransitionNAXA({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const isAuthRoute = ["/connexion", "/creation-compte", "/mot-de-passe-oublie", "/nouveau-mot-de-passe"].includes(pathname);

  useEffect(() => {
    if (isAuthRoute) {
      setActive(false);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(false);
      return;
    }
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 700);
    return () => window.clearTimeout(timer);
  }, [pathname, isAuthRoute]);

  return (
    <>
      <div aria-hidden="true" className={`naxa-page-sweep ${active ? "naxa-page-sweep-active" : ""}`} />
      <div className={`naxa-page-content ${active ? "naxa-page-content-active" : ""}`} data-route-transition={active ? "active" : "idle"}>
        {children}
      </div>
    </>
  );
}
