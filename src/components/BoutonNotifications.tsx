"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "@/lib/messagerie";

const PARTICULES = Array.from({ length: 100 }, (_, index) => {
  const angle = (index / 100) * Math.PI * 2 + (index % 7) * 0.07;
  const distance = 75 + ((index * 37) % 145);
  return { id: index, dx: `${Math.cos(angle) * distance}px`, dy: `${Math.sin(angle) * distance}px`, rotate: `${(index % 2 ? 1 : -1) * (180 + (index * 29) % 540)}deg`, delay: `${(index % 12) * 9}ms`, size: 3 + (index % 5) };
});

export function BoutonNotifications() {
  const { nonLus } = useNotifications();
  const router = useRouter();
  const [explosion, setExplosion] = useState(false);
  const [sonne, setSonne] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const precedentNonLus = useRef(nonLus);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (nonLus > precedentNonLus.current && nonLus > 0) {
      setSonne(true);
      const id = window.setTimeout(() => setSonne(false), 1250);
      precedentNonLus.current = nonLus;
      return () => window.clearTimeout(id);
    }
    precedentNonLus.current = nonLus;
  }, [nonLus]);

  const ouvrirNotifications = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (explosion) return;
    setExplosion(true);
    timer.current = setTimeout(() => router.push("/notifications"), 1550);
  };

  return <>
    <Link href="/notifications" onClick={ouvrirNotifications} aria-label={nonLus ? `Notifications, ${nonLus} non lues` : "Notifications"} className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10">
      <svg viewBox="0 0 24 24" className={`h-6 w-6 ${explosion ? "naxa-bell-burst" : sonne && nonLus > 0 ? "naxa-bell-ring" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
      {nonLus > 0 && <span className="absolute right-0 top-0 min-w-5 rounded-full bg-naxa-canari px-1 text-center text-[10px] font-extrabold leading-5 text-naxa-green-900">{nonLus > 9 ? "9+" : nonLus}</span>}
    </Link>
    {explosion && <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {PARTICULES.map(p => <span key={p.id} className="naxa-crystal" style={{ width:p.size, height:p.size*1.7, "--dx":p.dx, "--dy":p.dy, "--rot":p.rotate, "--delay":p.delay } as React.CSSProperties}/>)}
    </div>}
    <style jsx>{`
      @keyframes naxa-water-crystal { 0% { opacity: 0; transform: translate3d(0,0,0) scale(.25) rotate(0deg); } 10% { opacity: 1; } 72% { opacity: .95; } 100% { opacity: 0; transform: translate3d(var(--dx),var(--dy),0) scale(.15) rotate(var(--rot)); } }
      @keyframes naxa-bell-shatter { 0% { transform: scale(1); opacity: 1; } 30% { transform: scale(1.28) rotate(-9deg); } 65% { transform: scale(.25) rotate(18deg); opacity: .4; } 100% { transform: scale(0); opacity: 0; } }
      .naxa-crystal { position:absolute; left:50%; top:50%; border-radius:45% 55% 58% 42%; background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.98),rgba(144,239,255,.95) 34%,rgba(44,164,219,.8) 70%,rgba(255,255,255,.4)); box-shadow:0 0 12px rgba(123,225,255,.85),inset 0 0 3px white; animation:naxa-water-crystal 1.48s cubic-bezier(.12,.68,.2,1) both; animation-delay:var(--delay); }
      .naxa-bell-burst { animation:naxa-bell-shatter .65s ease-out both; }
      @keyframes naxa-ring-bell { 0%,100% { transform: rotate(0); } 10%,30%,50%,70% { transform: rotate(13deg); } 20%,40%,60%,80% { transform: rotate(-13deg); } 90% { transform: rotate(5deg); } }
      .naxa-bell-ring { transform-origin: 50% 12%; animation: naxa-ring-bell 1.15s ease-in-out both; }
      @media (prefers-reduced-motion: reduce) { .naxa-bell-ring, .naxa-bell-burst, .naxa-crystal { animation: none !important; } }
    `}</style>
  </>;
}
