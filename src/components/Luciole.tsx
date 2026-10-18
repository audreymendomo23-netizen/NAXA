"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

const SPARKS = 12;

export function Luciole() {
  const { night } = useTheme();
  const path = usePathname();
  const fireflyRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!night || path === "/scanner") return;
    const firefly = fireflyRef.current;
    const halo = haloRef.current;
    const tree = treeRef.current;
    if (!firefly || !halo || !tree) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let x = window.innerWidth * 0.5;
    let y = window.innerHeight * 0.4;
    let targetX = x;
    let targetY = y;
    let vx = 0;
    let vy = 0;
    let lastInput = performance.now();
    let frameId = 0;
    let lastFrame = 0;
    let resting = false;
    let treeX = window.innerWidth - 46;
    let treeY = 30;
    let wanderX = x;
    let wanderY = y;
    let seed = 0;

    const logo = () => document.querySelector<HTMLElement>('img[alt="NAXA"]');
    const placeTree = () => {
      const image = logo();
      if (image) {
        const r = image.getBoundingClientRect();
        treeX = Math.min(window.innerWidth - 18, r.left + r.width * 0.88);
        treeY = Math.max(8, r.top - 3);
      } else {
        treeX = Math.min(window.innerWidth - 18, 150);
        treeY = 22;
      }
      tree.style.transform = `translate3d(${treeX - 12}px, ${treeY - 8}px, 0)`;
    };

    const paint = () => {
      x = Math.max(12, Math.min(window.innerWidth - 12, x));
      y = Math.max(12, Math.min(window.innerHeight - 12, y));
      firefly.style.transform = `translate3d(${x - 24}px, ${y - 24}px, 0)`;
      halo.style.setProperty("--luciole-x", `${x}px`);
      halo.style.setProperty("--luciole-y", `${y}px`);
    };

    const sparks = Array.from(firefly.querySelectorAll<HTMLElement>(".luciole-spark"));
    const burst = () => {
      sparks.forEach((spark, i) => {
        const angle = (Math.PI * 2 * i) / sparks.length;
        spark.style.setProperty("--sx", `${Math.cos(angle) * (28 + (i % 3) * 13)}px`);
        spark.style.setProperty("--sy", `${Math.sin(angle) * (28 + (i % 3) * 13)}px`);
        spark.style.animation = "none";
        spark.style.opacity = "1";
        void spark.offsetWidth;
        spark.style.animation = "luciole-spark 850ms ease-out forwards";
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.buttons === 0) {
        // La luciole suit aussi le curseur sur ordinateur, sans capter les interactions.
      }
      lastInput = performance.now();
      resting = false;
      targetX = event.clientX;
      targetY = event.clientY;
      wanderX = targetX;
      wanderY = targetY;
      tree.classList.add("naxa-luciole-tree-awake");
      start();
    };
    const onInteraction = (event: Event) => {
      lastInput = performance.now();
      resting = false;
      tree.classList.add("naxa-luciole-tree-awake");
      if (event.type === "pointerdown") burst();
      start();
    };
    const onResize = () => { placeTree(); start(); };
    const onVisibility = () => {
      if (document.hidden) {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
      } else start();
    };

    const tick = (now: number) => {
      frameId = 0;
      if (document.hidden) return;
      const dt = lastFrame ? Math.min(40, now - lastFrame) : 16;
      lastFrame = now;
      const idleFor = now - lastInput;

      if (idleFor >= 60_000) {
        resting = true;
        targetX = treeX;
        targetY = treeY - 12;
        tree.classList.remove("naxa-luciole-tree-awake");
      } else {
        resting = false;
        if (idleFor >= 1600) {
          // Flânerie lente et organique pendant l'inactivité, jusqu'au retour à l'arbre.
          seed += dt * 0.00055;
          targetX = Math.max(28, Math.min(window.innerWidth - 28, wanderX + Math.sin(seed * 1.1) * 86));
          targetY = Math.max(40, Math.min(window.innerHeight - 40, wanderY + Math.cos(seed * 0.83) * 62));
        }
      }

      const ease = resting ? 0.055 : 0.085;
      vx = (vx + (targetX - x) * ease) * 0.78;
      vy = (vy + (targetY - y) * ease) * 0.78;
      x += vx;
      y += vy;
      paint();

      const settled = Math.abs(targetX - x) < 0.8 && Math.abs(targetY - y) < 0.8 && Math.abs(vx) + Math.abs(vy) < 0.35;
      if (!settled || !resting || idleFor < 60_000) frameId = requestAnimationFrame(tick);
      else {
        firefly.classList.add("naxa-luciole-resting");
        tree.classList.add("naxa-luciole-tree-glow");
      }
    };

    function start() {
      firefly.classList.remove("naxa-luciole-resting");
      tree.classList.remove("naxa-luciole-tree-glow");
      if (!frameId && !document.hidden) {
        lastFrame = 0;
        frameId = requestAnimationFrame(tick);
      }
    }

    placeTree();
    paint();
    if (!reducedMotion.matches) start();
    else {
      x = targetX;
      y = targetY;
      paint();
    }

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerdown", onInteraction, { passive: true });
    document.addEventListener("keydown", onInteraction);
    document.addEventListener("focusin", onInteraction);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onResize, { passive: true, capture: true });

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onInteraction);
      document.removeEventListener("keydown", onInteraction);
      document.removeEventListener("focusin", onInteraction);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      sparks.forEach((spark) => {
        spark.style.animation = "none";
        spark.style.opacity = "0";
      });
    };
  }, [night, path]);

  if (path === "/scanner") return null;

  return (
    <>
      <div ref={haloRef} className="naxa-luciole-light" aria-hidden="true" />
      <div ref={treeRef} className="naxa-luciole-tree" aria-hidden="true">
        <svg viewBox="0 0 32 42" role="presentation">
          <path className="naxa-tree-trunk" d="M16 39V17M16 27 9 20M16 23l7-8M16 32l8-5" />
          <path className="naxa-tree-leaf" d="M16 2C10 5 8 10 12 15c-6-1-8-6-5-10 2-2 5-3 9-3Zm1 4c7-1 11 3 9 8-2 4-6 4-10 2 4-2 4-6 1-10ZM8 15c-4 1-5 5-2 8 3 2 7 1 10-2-5 0-7-2-8-6Zm15 4c5-2 8 1 7 5-2 4-7 4-13 1 4-1 6-3 6-6Z" />
          <circle className="naxa-tree-star" cx="16" cy="17" r="2" />
        </svg>
      </div>
      <div ref={fireflyRef} className="naxa-luciole" aria-hidden="true">
        <span className="luciole-core" />
        {Array.from({ length: SPARKS }, (_, i) => <i key={i} className="luciole-spark" />)}
      </div>
    </>
  );
}
