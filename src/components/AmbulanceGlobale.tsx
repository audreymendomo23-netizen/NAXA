"use client";
import { useEffect, useRef, useState } from "react";
type Passage = { id: number; left: number; top: number; width: number; duration: number };
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
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const network = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }).connection;
      const base = network?.effectiveType === "slow-2g" || network?.effectiveType === "2g" ? 2800 : network?.effectiveType === "3g" || (network?.downlink !== undefined && network.downlink < 1.5) ? 2200 : 1600;
      const load = navigation?.loadEventEnd ? navigation.loadEventEnd - navigation.startTime : 0;
      const duration = Math.max(1400, Math.min(3200, Math.round(base * 0.65 + load * 0.35)));
      setPassage({ id: ++idRef.current, left: rect.left, top: rect.top + rect.height / 2, width: rect.width, duration });
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
  return <div key={passage.id} aria-hidden="true" className="naxa-ambulance-global" style={{ left: passage.left, top: passage.top, width: passage.width, "--naxa-ambulance-duration": `${passage.duration}ms` } as React.CSSProperties}>
    <span className="naxa-ambulance-global-car"><span className="naxa-ambulance-global-car-emoji">🚑</span></span><span className="naxa-ambulance-global-trail"/>
    <span className="naxa-ambulance-global-particle naxa-ambulance-global-particle-one"/>
    <span className="naxa-ambulance-global-particle naxa-ambulance-global-particle-two"/>
    <span className="naxa-ambulance-global-particle naxa-ambulance-global-particle-three"/>
  </div>;
}
