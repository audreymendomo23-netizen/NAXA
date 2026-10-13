"use client";

import { useEffect, useRef, useState } from "react";

type Props = { message: string };
type Drop = { x: number; y: number; vx: number; vy: number; radius: number; life: number; alpha: number };

const DROP_COUNT = 1400;

export function BulleErreur({ message }: Props) {
  const [shown, setShown] = useState("");
  const [burst, setBurst] = useState(false);
  const [gone, setGone] = useState(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const origin = useRef({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    setShown("");
    setBurst(false);
    setGone(false);
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
        @keyframes naxa-micro-water { 0% { transform: translateY(5px) scale(.55); opacity: 0; } 25% { opacity: .8; } 100% { transform: translateY(-25px) scale(1.1); opacity: 0; } }
        @keyframes naxa-water-glint { 0%,100% { transform: translateX(-18%) rotate(-12deg); opacity: .18; } 50% { transform: translateX(18%) rotate(-12deg); opacity: .42; } }
        @media (prefers-reduced-motion: reduce) { .naxa-error-water-motion { animation: none !important; } }
      `}</style>
      {!burst && (
        <div
          ref={bubbleRef}
          role="alert"
          aria-live="assertive"
          onClick={pop}
          className="fixed right-4 top-4 z-[100] max-w-[min(88vw,380px)] cursor-pointer overflow-hidden rounded-[28px] border border-white/50 bg-cyan-100/[0.12] px-5 py-4 text-sm font-semibold leading-relaxed text-white shadow-[0_10px_36px_rgba(8,145,178,.12)] backdrop-blur-2xl sm:right-6 sm:top-5"
          style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,.4), 0 10px 36px rgba(8,145,178,.12)" }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/15" />
          <span aria-hidden="true" className="naxa-error-water-motion pointer-events-none absolute -inset-y-6 left-1/4 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent blur-md" style={{ animation: "naxa-water-glint 4.8s ease-in-out infinite" }} />
          {[8, 20, 33, 47, 61, 74, 88].map((left, index) => (
            <span
              key={left}
              aria-hidden="true"
              className="naxa-error-water-motion pointer-events-none absolute bottom-1 rounded-full border border-white/70 bg-white/30"
              style={{ left: `${left}%`, width: index % 3 === 0 ? 4 : 3, height: index % 3 === 0 ? 4 : 3, animation: `naxa-micro-water ${1.8 + index * 0.12}s ${index * 170}ms ease-out infinite` }}
            />
          ))}
          <span className="relative z-10 block min-h-5">{shown}</span>
        </div>
      )}
      {burst && <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[110] h-full w-full" />}
    </>
  );
}
