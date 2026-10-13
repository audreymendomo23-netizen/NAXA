"use client";

import { useEffect, useRef, useState } from "react";

type Props = { message: string };

const DROPS = [
  ["-34px", "-48px"], ["-10px", "-62px"], ["18px", "-54px"], ["43px", "-34px"],
  ["-52px", "-16px"], ["-27px", "18px"], ["4px", "34px"], ["35px", "22px"],
  ["56px", "5px"], ["-43px", "30px"], ["14px", "-25px"], ["-3px", "-8px"],
] as const;

const MICRO_BUBBLES = [
  { left: "8%", delay: "0ms", size: 4 }, { left: "19%", delay: "420ms", size: 3 },
  { left: "31%", delay: "180ms", size: 5 }, { left: "44%", delay: "760ms", size: 3 },
  { left: "57%", delay: "300ms", size: 4 }, { left: "69%", delay: "620ms", size: 3 },
  { left: "81%", delay: "120ms", size: 5 }, { left: "92%", delay: "500ms", size: 3 },
];

export function BulleErreur({ message }: Props) {
  const [shown, setShown] = useState("");
  const [burst, setBurst] = useState(false);
  const [gone, setGone] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const start = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    setShown("");
    setBurst(false);
    setGone(false);
    setOffset({ x: 0, y: 0 });
    let i = 0;
    const typing = window.setInterval(() => {
      i += 1;
      setShown(message.slice(0, i));
      if (i >= message.length) window.clearInterval(typing);
    }, 24);
    return () => window.clearInterval(typing);
  }, [message]);

  useEffect(() => {
    if (shown.length !== message.length || !message || burst) return;
    const timer = window.setTimeout(() => setBurst(true), 5000);
    return () => window.clearTimeout(timer);
  }, [shown, message, burst]);

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setGone(true), 850);
    return () => window.clearTimeout(timer);
  }, [burst]);

  if (gone) return null;

  function pop() {
    setBurst(true);
  }

  return (
    <>
      <style>{`
        @keyframes naxa-water-pop { 0% { transform:scale(1); opacity:1; border-radius:48% 52% 62% 38% / 43% 40% 60% 57%; } 45% { transform:scale(1.06); opacity:.92; } 100% { transform:scale(.12); opacity:0; filter:blur(5px); } }
        @keyframes naxa-water-drop { 0% { transform:translate(0,0) scale(1); opacity:.9; } 100% { transform:translate(var(--drop-x),var(--drop-y)) scale(.08); opacity:0; filter:blur(2px); } }
        @keyframes naxa-micro-bubble { 0% { transform:translateY(8px) scale(.55); opacity:0; } 20% { opacity:.85; } 75% { opacity:.55; } 100% { transform:translateY(-30px) scale(1.15); opacity:0; } }
        @keyframes naxa-water-sheen { 0%,100% { transform:translateX(-16%) rotate(-12deg); opacity:.22; } 50% { transform:translateX(16%) rotate(-12deg); opacity:.48; } }
        @media (prefers-reduced-motion: reduce) { .naxa-water-motion,.naxa-micro-bubble,.naxa-water-sheen { animation-duration:.01ms !important; animation-iteration-count:1 !important; } }
      `}</style>
      <div
        style={{ transform: `translate(${offset.x}px,${offset.y}px)`, maxWidth: "min(86vw, 360px)" }}
        onPointerDown={(e) => {
          dragged.current = false;
          start.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const dx = e.clientX - start.current.x;
          const dy = e.clientY - start.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 7) dragged.current = true;
          if (dragged.current) setOffset({ x: start.current.ox + dx, y: start.current.oy + dy });
        }}
        onPointerUp={() => {
          if (!dragged.current) pop();
          start.current = null;
        }}
        onPointerCancel={() => { start.current = null; }}
        role="alert"
        aria-live="assertive"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") pop(); }}
        className="fixed right-4 top-4 z-[100] touch-none cursor-grab select-none sm:right-6 sm:top-5"
      >
        {!burst ? (
          <div className="relative isolate overflow-hidden rounded-[28px] border border-white/55 bg-gradient-to-br from-white/35 via-cyan-100/20 to-teal-200/30 px-5 py-4 text-sm font-semibold text-slate-900 shadow-[0_12px_38px_rgba(10,70,85,.20)] backdrop-blur-2xl">
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/25" />
            <span aria-hidden="true" className="naxa-water-sheen pointer-events-none absolute -inset-y-8 left-1/4 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-md" style={{ animation: "naxa-water-sheen 4s ease-in-out infinite" }} />
            {MICRO_BUBBLES.map((bubble, i) => (
              <span key={i} aria-hidden="true" className="naxa-micro-bubble pointer-events-none absolute bottom-1 rounded-full border border-white/80 bg-white/55 shadow-[0_0_5px_rgba(255,255,255,.65)]" style={{ left: bubble.left, width: bubble.size, height: bubble.size, animation: `naxa-micro-bubble 1.9s ${bubble.delay} ease-out infinite` }} />
            ))}
            <span className="relative z-10 block min-h-5 pr-1">{shown}<span className="ml-0.5 animate-pulse">▏</span></span>
            <span className="relative z-10 mt-1 block text-[10px] font-medium text-slate-700/80">Touchez pour fermer · Maintenez pour déplacer</span>
          </div>
        ) : (
          <div className="relative h-24 w-64">
            <div className="naxa-water-motion absolute inset-0 rounded-[50%] border border-white/70 bg-gradient-to-br from-white/70 via-cyan-100/55 to-sky-300/60 shadow-[0_8px_24px_rgba(30,140,170,.2)] backdrop-blur-xl" style={{ animation: "naxa-water-pop .45s ease-out forwards" }} />
            {DROPS.map(([x, y], i) => (
              <span key={i} className="naxa-water-motion absolute left-1/2 top-1/2 h-3 w-3 rounded-full border border-white/70 bg-gradient-to-br from-white/90 to-sky-300/60 shadow-sm" style={{ ["--drop-x" as string]: x, ["--drop-y" as string]: y, animation: `naxa-water-drop .75s ${i * 18}ms ease-out forwards` }} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
