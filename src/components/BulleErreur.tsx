"use client";

import { useEffect, useRef, useState } from "react";

type Props = { message: string };
type Drop = { x: number; y: number; vx: number; vy: number; radius: number; life: number; alpha: number };

const DROP_COUNT = 1400;

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
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const origin = useRef({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    setShown("");
    setBurst(false);
    setGone(false);
    setOffset({ x: 0, y: 0 });
    let index = 0;
    const typing = window.setInterval(() => {
      index += 1;
      setShown(message.slice(0, index));
      if (index >= message.length) window.clearInterval(typing);
    }, 28);
    return () => window.clearInterval(typing);
  }, [message]);

  useEffect(() => {
    if (shown.length !== message.length || !message || burst) return;
    const timer = window.setTimeout(() => {
      const rect = bubbleRef.current?.getBoundingClientRect();
      if (rect) origin.current = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      setBurst(true);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [shown, message, burst]);

  useEffect(() => {
    if (!burst) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      setGone(true);
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setGone(true);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const centerX = origin.current.x + origin.current.width / 2;
    const centerY = origin.current.y + origin.current.height / 2;
    const drops: Drop[] = Array.from({ length: DROP_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 11;
      return {
        x: centerX + (Math.random() - 0.5) * origin.current.width * 0.8,
        y: centerY + (Math.random() - 0.5) * origin.current.height * 0.8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 2.5,
        radius: 0.45 + Math.random() * 1.8,
        life: 35 + Math.random() * 45,
        alpha: 0.45 + Math.random() * 0.5,
      };
    });

    let frame = 0;
    let tick = 0;
    const draw = () => {
      context.clearRect(0, 0, width, height);
      let alive = 0;
      for (const drop of drops) {
        if (drop.life <= 0) continue;
        alive += 1;
        drop.x += drop.vx;
        drop.y += drop.vy;
        drop.vy += 0.105;
        drop.vx *= 0.991;
        drop.life -= 1;
        const opacity = Math.max(0, Math.min(1, drop.life / 18)) * drop.alpha;
        context.beginPath();
        context.fillStyle = `rgba(178, 250, 255, ${opacity})`;
        context.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
        context.lineWidth = 0.65;
        context.arc(drop.x - drop.radius * 0.2, drop.y - drop.radius * 0.2, drop.radius * 0.55, Math.PI, Math.PI * 1.65);
        context.stroke();
      }
      tick += 1;
      if (alive && tick < 90) frame = window.requestAnimationFrame(draw);
      else setGone(true);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [burst]);

  function pop() {
    if (burst || gone) return;
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (rect) origin.current = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    setBurst(true);
  }

  if (gone) return null;

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
          </div>
        ) : (
          <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[99] h-full w-full" />
        )}
      </div>
    </>
  );
}
