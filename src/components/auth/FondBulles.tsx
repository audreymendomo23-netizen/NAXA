"use client";

import { useEffect, useRef } from "react";

type Bulle = { x: number; y: number; vx: number; vy: number; r: number };
type Particule = { x: number; y: number; vx: number; vy: number; vie: number; rayon: number; couleur: string };
type Halo = { x: number; y: number; vie: number };

export function FondBulles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = 0;
    let dernierGeste = 0;
    const bulles: Bulle[] = [];
    const particules: Particule[] = [];
    const halos: Halo[] = [];
    const couleurs = ["rgba(255, 227, 61,", "rgba(10, 107, 58,", "rgba(255, 255, 255,"];

    const redimensionner = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (bulles.length === 0) {
        for (let i = 0; i < 10; i++) {
          const r = 15 + Math.random() * 45;
          bulles.push({
            x: r + Math.random() * Math.max(1, width - r * 2),
            y: r + Math.random() * Math.max(1, height - r * 2),
            vx: (Math.random() - 0.5) * 0.34,
            vy: (Math.random() - 0.5) * 0.34,
            r,
          });
        }
      } else {
        bulles.forEach((b) => {
          b.x = Math.min(width - b.r, Math.max(b.r, b.x));
          b.y = Math.min(height - b.r, Math.max(b.r, b.y));
        });
      }
      if (reduceMotion) dessiner(performance.now(), false);
    };

    const ajouterInteraction = (clientX: number, clientY: number, nombre: number) => {
      if (reduceMotion) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      halos.push({ x, y, vie: 1 });
      for (let i = 0; i < nombre; i++) {
        const angle = Math.random() * Math.PI * 2;
        const vitesse = 0.45 + Math.random() * 1.8;
        particules.push({
          x,
          y,
          vx: Math.cos(angle) * vitesse,
          vy: Math.sin(angle) * vitesse,
          vie: 1,
          rayon: 1 + Math.random() * 1.8,
          couleur: couleurs[Math.floor(Math.random() * couleurs.length)],
        });
      }
      if (particules.length > 140) particules.splice(0, particules.length - 140);
      if (halos.length > 12) halos.splice(0, halos.length - 12);
    };

    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.buttons === 0) {
        const now = performance.now();
        if (now - dernierGeste < 42) return;
        dernierGeste = now;
        ajouterInteraction(event.clientX, event.clientY, 2);
      } else {
        const now = performance.now();
        if (now - dernierGeste < 42) return;
        dernierGeste = now;
        ajouterInteraction(event.clientX, event.clientY, 3);
      }
    };
    const pointerDown = (event: PointerEvent) => ajouterInteraction(event.clientX, event.clientY, 12);

    function dessiner(now: number, animer = true) {
      const delta = Math.min(2, previous ? (now - previous) / 16.67 : 1);
      previous = now;
      context!.clearRect(0, 0, width, height);

      bulles.forEach((b, index) => {
        if (animer && !reduceMotion) {
          b.x += b.vx * delta;
          b.y += b.vy * delta;
          if (b.x < b.r || b.x > width - b.r) b.vx *= -1;
          if (b.y < b.r || b.y > height - b.r) b.vy *= -1;
          b.x = Math.min(width - b.r, Math.max(b.r, b.x));
          b.y = Math.min(height - b.r, Math.max(b.r, b.y));
        }
        const reflet = context!.createRadialGradient(
          b.x - b.r * 0.3, b.y - b.r * 0.35, 1, b.x, b.y, b.r
        );
        reflet.addColorStop(0, "rgba(255,255,255,0)");
        reflet.addColorStop(0.78, index % 2 ? "rgba(10,107,58,0.015)" : "rgba(255,227,61,0.02)");
        reflet.addColorStop(1, index % 2 ? "rgba(10,107,58,0.08)" : "rgba(184,143,0,0.12)");
        context!.beginPath();
        context!.fillStyle = reflet;
        context!.strokeStyle = index % 2 ? "rgba(10,107,58,0.14)" : "rgba(184,143,0,0.19)";
        context!.lineWidth = 1;
        context!.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        context!.fill();
        context!.stroke();
      });

      if (animer && !reduceMotion) {
        halos.forEach((h) => {
          h.vie -= delta / 60;
          const progression = 1 - h.vie;
          const rayon = 8 + progression * 35;
          const gradient = context!.createRadialGradient(h.x, h.y, 0, h.x, h.y, rayon);
          gradient.addColorStop(0, `rgba(255,227,61,${Math.max(0, h.vie) * 0.10})`);
          gradient.addColorStop(1, "rgba(255,227,61,0)");
          context!.beginPath();
          context!.fillStyle = gradient;
          context!.arc(h.x, h.y, rayon, 0, Math.PI * 2);
          context!.fill();
        });
        halos.splice(0, halos.length, ...halos.filter((h) => h.vie > 0));

        particules.forEach((p) => {
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.vie -= delta / 60;
          context!.beginPath();
          context!.fillStyle = `${p.couleur}${Math.max(0, p.vie) * 0.65})`;
          context!.arc(p.x, p.y, p.rayon, 0, Math.PI * 2);
          context!.fill();
        });
        particules.splice(0, particules.length, ...particules.filter((p) => p.vie > 0));
        frame = window.requestAnimationFrame((t) => dessiner(t, true));
      }
    }

    redimensionner();
    const observer = new ResizeObserver(redimensionner);
    observer.observe(canvas);
    if (!reduceMotion) {
      window.addEventListener("pointermove", pointerMove, { passive: true });
      window.addEventListener("pointerdown", pointerDown, { passive: true });
      frame = window.requestAnimationFrame((t) => dessiner(t, true));
    }

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerdown", pointerDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 0, background: "transparent" }}
    />
  );
}
