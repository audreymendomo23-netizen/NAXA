"use client";
import { useEffect, useRef, useState } from "react";
type Passage = { id: number; left: number; top: number; width: number };
export function AmbulanceGlobale() {
  const [passage, setPassage] = useState<Passage | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('button:not(:disabled):not([aria-disabled="true"]), input[type="submit"]:not(:disabled), [role="button"]:not([aria-disabled="true"])')
        : null;
      if (!target || target.closest("[data-naxa-no-ambulance]")) return;
      const rect = target.getBoundingClientRect();
      setPassage({ id: ++idRef.current, left: rect.left, top: rect.top + rect.height / 2, width: rect.width });
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setPassage(null), 3400);
    };
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("click", click, true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);
  if (!passage) return null;
  return <div key={passage.id} aria-hidden="true" className="naxa-ambulance-global" style={{ left: passage.left, top: passage.top, width: passage.width }}>
    <span className="naxa-ambulance-global-car">🚑</span><span className="naxa-ambulance-global-trail"/>
    <span className="naxa-ambulance-global-particle naxa-ambulance-global-particle-one"/>
    <span className="naxa-ambulance-global-particle naxa-ambulance-global-particle-two"/>
    <span className="naxa-ambulance-global-particle naxa-ambulance-global-particle-three"/>
  </div>;
}
