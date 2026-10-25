"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePanier } from "@/lib/panier";

type Trajet = { id: number; x: number; y: number; dx: number; dy: number; nom: string };
type AjoutEvent = CustomEvent<{ nom?: string; dosage?: string; origine?: { x: number; y: number } | null }>;

export function BoutonPanierEntete() {
  const { nombre, pret } = usePanier();
  const [arrival, setArrival] = useState(false);
  const [trajets, setTrajets] = useState<Trajet[]>([]);
  const targetRef = useRef<HTMLAnchorElement>(null);
  const sequence = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const arrived = (event: Event) => {
      setArrival(true);
      const reset = window.setTimeout(() => setArrival(false), 850);
      timers.current.push(reset);
      const detail = (event as AjoutEvent).detail;
      const origin = detail?.origine;
      const target = targetRef.current?.getBoundingClientRect();
      if (!origin || !target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const id = ++sequence.current;
      const x = origin.x;
      const y = origin.y;
      setTrajets(current => [...current.slice(-2), { id, x, y, dx: target.left + target.width / 2 - x, dy: target.top + target.height / 2 - y, nom: detail.nom || "Médicament" }]);
      const cleanup = window.setTimeout(() => setTrajets(current => current.filter(item => item.id !== id)), 820);
      timers.current.push(cleanup);
    };
    window.addEventListener("naxa:panier-ajoute", arrived);
    return () => {
      window.removeEventListener("naxa:panier-ajoute", arrived);
      timers.current.forEach(window.clearTimeout);
    };
  }, []);

  return <>
    <Link ref={targetRef} href="/panier" aria-label={`Ouvrir le panier, ${nombre} article${nombre === 1 ? "" : "s"}`} title="Mon panier" className={`relative -mx-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#FFE33D] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFE33D] ${arrival ? "naxa-cart-arrival" : "naxa-cart-pulse"}`}>
      <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.1 11.2a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 1.9-1.5L22 8H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg>
      {pret && nombre > 0 && <span className="absolute right-0 top-0 flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#FFE33D] px-1 text-[10px] font-black leading-none text-[#064B2A]">{nombre > 99 ? "99+" : nombre}</span>}
    </Link>
    {trajets.map(item => <span key={item.id} aria-hidden="true" title={item.nom} className="naxa-medication-flight" style={{ left: item.x, top: item.y, "--dx": `${item.dx}px`, "--dy": `${item.dy}px` } as React.CSSProperties}>
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4.9 19.1a5 5 0 0 1 0-7.1l7.1-7.1a5 5 0 0 1 7.1 7.1L12 19.1a5 5 0 0 1-7.1 0Z" fill="#fff" stroke="#0F6B3F"/><path d="m8.5 8.5 7 7" stroke="#C93774"/></svg>
    </span>)}
    <style jsx>{`
      @keyframes naxa-cart-arrive { 0% { transform: scale(1); } 35% { transform: scale(1.18) rotate(-5deg); } 70% { transform: scale(.92) rotate(4deg); } 100% { transform: scale(1); } }
      @keyframes naxa-medication-flight { 0% { opacity: 0; transform: translate3d(0,0,0) scale(1.25) rotate(-12deg); } 12% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; transform: translate3d(var(--dx),var(--dy),0) scale(.16) rotate(20deg); } }
      .naxa-cart-arrival { animation: naxa-cart-arrive .48s ease-out; }
      .naxa-medication-flight { position: fixed; z-index: 120; pointer-events: none; display: grid; place-items: center; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%; background: rgba(255,255,255,.96); box-shadow: 0 3px 14px rgba(15,107,63,.24); color: #0F6B3F; animation: naxa-medication-flight .78s cubic-bezier(.18,.72,.28,1) both; }
      @media (prefers-reduced-motion: reduce) { .naxa-cart-arrival, .naxa-medication-flight { animation: none !important; } }
    `}</style>
  </>;
}
