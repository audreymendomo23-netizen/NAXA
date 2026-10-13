"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function TransitionNAXA({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(false);
      return;
    }
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 700);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      <div aria-hidden="true" className={`naxa-page-sweep ${active ? "naxa-page-sweep-active" : ""}`} />
      <div className={`naxa-page-content ${active ? "naxa-page-content-active" : ""}`} data-route-transition={active ? "active" : "idle"}>
        {children}
      </div>
    </>
  );
}
