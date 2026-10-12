"use client";

import { useEffect, useRef, useState } from "react";

type Props = { message: string };

const DROPS = [
  ["-34px", "-48px"], ["-10px", "-62px"], ["18px", "-54px"], ["43px", "-34px"],
  ["-52px", "-16px"], ["-27px", "18px"], ["4px", "34px"], ["35px", "22px"],
  ["56px", "5px"], ["-43px", "30px"], ["14px", "-25px"], ["-3px", "-8px"],
] as const;

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
        @keyframes naxa-water-pop { 0% { transform:scale(1); opacity:1; border-radius:48% 52% 62% 38% / 43% 40% 60% 57%; } 45% { transform:scale(1.12); opacity:.95; } 100% { transform:scale(.12); opacity:0; filter:blur(5px); } }
        @keyframes naxa-water-drop { 0% { transform:translate(0,0) scale(1); opacity:1; } 100% { transform:translate(var(--drop-x),var(--drop-y)) scale(.08); opacity:0; filter:blur(2px); } }
        @media (prefers-reduced-motion: reduce) { .naxa-water-motion { animation-duration:.01ms !important; } }
      `}</style>
      <div
        style={{ transform: `translate(${offset.x}px,${offset.y}px)`, maxWidth: "min(86vw, 340px)" }}
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
        className="fixed bottom-5 right-4 z-[100] touch-none cursor-grab select-none"
      >
        {!burst ? (
          <div className="relative rounded-[28px] border border-white/80 bg-gradient-to-br from-white via-rose-50 to-sky-100 px-5 py-4 text-sm font-semibold text-slate-800 shadow-[0_12px_38px_rgba(20,40,70,.28)] backdrop-blur-md">
            <span className="absolute -top-2 left-7 h-4 w-4 rounded-full border border-white/80 bg-white/90" />
            <span className="absolute -bottom-1 right-8 h-3 w-3 rounded-full bg-sky-100" />
            <span className="block min-h-5">{shown}<span className="ml-0.5 animate-pulse">▏</span></span>
            <span className="mt-1 block text-[10px] font-medium text-slate-500">Touchez pour fermer · Maintenez pour déplacer</span>
          </div>
        ) : (
          <div className="relative h-24 w-64">
            <div className="naxa-water-motion absolute inset-0 rounded-[50%] bg-gradient-to-br from-white via-rose-100 to-sky-200 shadow-lg" style={{ animation: "naxa-water-pop .45s ease-out forwards" }} />
            {DROPS.map(([x, y], i) => (
              <span key={i} className="naxa-water-motion absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-gradient-to-br from-white to-sky-300 shadow-sm" style={{ ["--drop-x" as string]: x, ["--drop-y" as string]: y, animation: `naxa-water-drop .75s ${i * 18}ms ease-out forwards` }} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
