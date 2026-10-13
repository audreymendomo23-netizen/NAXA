"use client";

import { useEffect, useRef } from "react";

type Bubble = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  poppingUntil: number;
  particles: Array<{ x: number; y: number; vx: number; vy: number; life: number }>;
};

const COUNT_DESKTOP = 14;

function randomBubble(width: number, height: number): Bubble {
  const r = 9 + Math.random() * 14;
  return {
    x: r + Math.random() * Math.max(1, width - r * 2),
    y: r + Math.random() * Math.max(1, height - r * 2),
    vx: (Math.random() - 0.5) * 0.34,
    vy: (Math.random() - 0.5) * 0.34,
    r,
    poppingUntil: 0,
    particles: [],
  };
}

export function BullesAuthentification() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = 0;
    const bubbles: Bubble[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (bubbles.length === 0) {
        const count = width < 520 ? 7 : COUNT_DESKTOP;
        for (let i = 0; i < count; i++) bubbles.push(randomBubble(width, height));
      } else {
        bubbles.forEach((bubble) => {
          bubble.x = Math.min(width - bubble.r, Math.max(bubble.r, bubble.x));
          bubble.y = Math.min(height - bubble.r, Math.max(bubble.r, bubble.y));
        });
      }
    };

    const pop = (bubble: Bubble, now: number) => {
      if (bubble.poppingUntil > now) return;
      bubble.poppingUntil = now + 420;
      bubble.particles = Array.from({ length: 7 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.25 + Math.random() * 0.8;
        return {
          x: bubble.x,
          y: bubble.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
        };
      });
    };

    const pointerDown = (event: PointerEvent) => {
      if (reduceMotion) return;
      const bubble = randomBubble(width, height);
      bubble.x = Math.max(bubble.r, Math.min(width - bubble.r, event.clientX));
      bubble.y = Math.max(bubble.r, Math.min(height - bubble.r, event.clientY));
      bubble.r = 13;
      bubbles.push(bubble);
      pop(bubble, performance.now());
      if (bubbles.length > COUNT_DESKTOP + 5) bubbles.shift();
    };
    const draw = (now: number) => {
      if (!context) return;
      const delta = Math.min(2, previous ? (now - previous) / 16.67 : 1);
      previous = now;
      context.clearRect(0, 0, width, height);

      bubbles.forEach((bubble) => {
        if (bubble.poppingUntil > 0 && now >= bubble.poppingUntil) {
          const fresh = randomBubble(width, height);
          Object.assign(bubble, fresh);
        }
        if (bubble.poppingUntil > now) {
          bubble.particles.forEach((particle) => {
            const age = Math.max(0, 1 - (bubble.poppingUntil - now) / 420);
            particle.x += particle.vx * delta;
            particle.y += particle.vy * delta;
            particle.life = 1 - age;
            context.beginPath();
            context.fillStyle = `rgba(255, 227, 61, ${Math.max(0, particle.life * 0.55)})`;
            context.arc(particle.x, particle.y, 1.2 + particle.life, 0, Math.PI * 2);
            context.fill();
          });
          return;
        }

        if (!reduceMotion) {
          bubble.x += bubble.vx * delta;
          bubble.y += bubble.vy * delta;
          if (bubble.x < bubble.r || bubble.x > width - bubble.r) bubble.vx *= -1;
          if (bubble.y < bubble.r || bubble.y > height - bubble.r) bubble.vy *= -1;
          bubble.x = Math.min(width - bubble.r, Math.max(bubble.r, bubble.x));
          bubble.y = Math.min(height - bubble.r, Math.max(bubble.r, bubble.y));
        }

        const gradient = context.createRadialGradient(
          bubble.x - bubble.r * 0.32,
          bubble.y - bubble.r * 0.38,
          1,
          bubble.x,
          bubble.y,
          bubble.r,
        );
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.12)");
        gradient.addColorStop(0.72, "rgba(10, 107, 58, 0.045)");
        gradient.addColorStop(1, "rgba(255, 227, 61, 0.10)");
        context.beginPath();
        context.fillStyle = gradient;
        context.strokeStyle = "rgba(10, 107, 58, 0.18)";
        context.lineWidth = 1;
        context.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.beginPath();
        context.strokeStyle = "rgba(255, 255, 255, 0.55)";
        context.lineWidth = 1.3;
        context.arc(
          bubble.x - bubble.r * 0.12,
          bubble.y - bubble.r * 0.12,
          bubble.r * 0.72,
          Math.PI * 1.05,
          Math.PI * 1.52,
        );
        context.stroke();
      });

      if (!reduceMotion) {
        for (let i = 0; i < bubbles.length; i++) {
          const a = bubbles[i];
          if (a.poppingUntil > now) continue;
          for (let j = i + 1; j < bubbles.length; j++) {
            const b = bubbles[j];
            if (b.poppingUntil > now) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.hypot(dx, dy);
            const minDistance = a.r + b.r;
            if (distance > 0 && distance < minDistance) {
              pop(a, now);
              pop(b, now);
            }
          }
        }
      }

      // En réduction des animations, dessiner une image statique et ne pas boucler à 60 FPS.
      if (!reduceMotion) frame = window.requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      // Le canvas est effacé par resize : redessiner l'image statique si les animations sont réduites.
      if (reduceMotion) draw(performance.now());
    });
    observer.observe(canvas);
    frame = window.requestAnimationFrame(draw);
    window.addEventListener("pointerdown", pointerDown, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointerdown", pointerDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  );
}

export const FondBulles = BullesAuthentification;
