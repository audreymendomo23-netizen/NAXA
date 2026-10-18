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
    let nextWanderAt = 0;
    let nextWanderX = x;
    let nextWanderY = y;
    // Ajout non intrusif : guidage temporaire vers le caret ou le bouton actif.
    let guidedTarget: { x: number; y: number; kind: "caret" | "button"; field?: HTMLInputElement | HTMLTextAreaElement; form?: HTMLFormElement } | null = null;
    let guidePulseUntil = 0;
    let guideGlowUntil = 0;
    let validationTimer: number | undefined;
    let clickSparkTimer: number | undefined;
    let invalidFocusTimer: number | undefined;
    let lastValidationForm: HTMLFormElement | null = null;
    const guideCanvas = document.createElement("canvas");
    const guideContext = guideCanvas.getContext("2d");
    const motionAllowed = !reducedMotion.matches;
    const isTextField = (element: EventTarget | null): element is HTMLInputElement | HTMLTextAreaElement =>
      !!element && (element instanceof HTMLTextAreaElement ||
        (element instanceof HTMLInputElement && /^(text|email|password|search|tel|url|number)$/i.test(element.type)));
    const caretTarget = (field: HTMLInputElement | HTMLTextAreaElement) => {
      const rect = field.getBoundingClientRect();
      const style = window.getComputedStyle(field);
      const position = field.selectionStart ?? field.value.length;
      if (guideContext) guideContext.font = style.font;
      // Un mot de passe est mesuré uniquement comme une suite de points masqués.
      const measuredText = field instanceof HTMLInputElement && field.type === "password"
        ? "•".repeat(position) : field.value.slice(0, position);
      const width = guideContext?.measureText(measuredText).width ?? position * (parseFloat(style.fontSize) || 16) * 0.52;
      const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) || 16) * 1.35;
      const padLeft = parseFloat(style.paddingLeft) || 0;
      const padTop = parseFloat(style.paddingTop) || 0;
      const innerX = rect.left + padLeft + width - field.scrollLeft;
      const innerY = field instanceof HTMLTextAreaElement
        ? rect.top + padTop + Math.min(field.scrollHeight - padTop, lineHeight * (field.value.slice(0, position).split("\\n").length - 1))
        : rect.top + (rect.height - lineHeight) / 2 + lineHeight * 0.15;
      return { x: Math.max(14, Math.min(window.innerWidth - 14, innerX)), y: Math.max(16, innerY - 13), kind: "caret" as const, field, form: field.form ?? undefined };
    };
    const guideToCaret = (field: HTMLInputElement | HTMLTextAreaElement, glow = false) => {
      guidedTarget = caretTarget(field);
      guidePulseUntil = performance.now() + 650;
      if (glow) { guideGlowUntil = performance.now() + 480; firefly.classList.add("naxa-luciole-typing-glow"); }
      lastInput = performance.now();
      resting = false;
      tree.classList.add("naxa-luciole-tree-awake");
      start();
    };
    const guideToButton = (button: HTMLElement) => {
      const r = button.getBoundingClientRect();
      guidedTarget = { x: Math.max(20, Math.min(window.innerWidth - 20, r.left + r.width * 0.72)), y: Math.max(20, r.top - 9), kind: "button", form: button.closest("form") ?? undefined };
      guidePulseUntil = Number.POSITIVE_INFINITY;
      lastInput = performance.now();
      resting = false;
      tree.classList.add("naxa-luciole-tree-awake");
      start();
    };

    const randomViewportPoint = () => ({
      x: 30 + Math.random() * Math.max(1, window.innerWidth - 60),
      y: 34 + Math.random() * Math.max(1, window.innerHeight - 68),
    });

    const logo = () => document.querySelector<HTMLElement>('img[alt="NAXA"]');
    const placeTree = () => {
      const image = logo();
      if (image) {
        const r = image.getBoundingClientRect();
        // Le bord droit du logo correspond au côté extérieur du dernier « A ».
        // Le tronc de l’arbre se termine sur la même ligne de base que le logo.
        treeX = Math.min(window.innerWidth - 14, r.right + 14);
        treeY = r.bottom - 24;
      } else {
        treeX = Math.min(window.innerWidth - 14, 164);
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
      nextWanderAt = 0;
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
    const onGuidanceFocusIn = (event: FocusEvent) => {
      if (isTextField(event.target)) guideToCaret(event.target);
      else if (event.target instanceof HTMLElement && event.target.matches("button, input[type=submit], input[type=button], [role=button]")) guideToButton(event.target);
    };
    const onGuidanceFocusOut = (event: FocusEvent) => {
      if (!isTextField(event.target)) return;
      const field = event.target;
      window.requestAnimationFrame(() => {
        if (isTextField(document.activeElement)) guideToCaret(document.activeElement);
        else if (document.activeElement instanceof HTMLElement && document.activeElement.matches("button, input[type=submit], input[type=button], [role=button]")) guideToButton(document.activeElement);
        else if (guidedTarget?.field === field) {
          guidedTarget = null;
          firefly.classList.remove("naxa-luciole-guidance-pulse", "naxa-luciole-typing-glow");
        }
      });
    };
    const onGuidanceInput = (event: Event) => {
      if (isTextField(event.target) && document.activeElement === event.target) guideToCaret(event.target, true);
    };
    const onGuidanceSelection = () => {
      if (isTextField(document.activeElement)) guideToCaret(document.activeElement);
    };
    const onGuidancePointerDown = (event: PointerEvent) => {
      const element = event.target;
      const button = element instanceof HTMLElement ? element.closest<HTMLElement>("button, input[type=submit], input[type=button], [role=button]") : null;
      if (button && button.getAttribute("aria-disabled") !== "true" && !(button instanceof HTMLButtonElement && button.disabled)) guideToButton(button);
    };
    const onGuidanceSelectionChange = () => {
      if (isTextField(document.activeElement)) guideToCaret(document.activeElement);
    };
    const onGuidancePointerMove = (event: PointerEvent) => {
      if (isTextField(document.activeElement)) return;
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const button = element instanceof HTMLElement ? element.closest<HTMLElement>("button, input[type=submit], input[type=button], [role=button]") : null;
      if (button && button.getAttribute("aria-disabled") !== "true" && !(button instanceof HTMLButtonElement && button.disabled)) guideToButton(button);
      else if (guidedTarget?.kind === "button") {
        guidedTarget = null;
        firefly.classList.remove("naxa-luciole-guidance-pulse");
      }
    };
    const onGuidanceClick = (event: MouseEvent) => {
      const element = event.target;
      const button = element instanceof HTMLElement ? element.closest<HTMLElement>("button, input[type=submit], input[type=button], [role=button]") : null;
      if (!button) return;
      burst();
      firefly.classList.add("naxa-luciole-click-spark");
      if (clickSparkTimer) window.clearTimeout(clickSparkTimer);
      clickSparkTimer = window.setTimeout(() => { firefly.classList.remove("naxa-luciole-click-spark"); clickSparkTimer = undefined; }, reducedMotion.matches ? 0 : 360);
      const form = button.closest("form");
      if (form) {
        lastValidationForm = form;
        if (validationTimer) window.clearTimeout(validationTimer);
        validationTimer = window.setTimeout(() => {
          validationTimer = undefined;
          if (!lastValidationForm) return;
          const invalid = lastValidationForm.querySelector<HTMLElement>(":invalid, [aria-invalid='true']");
          const alert = lastValidationForm.querySelector<HTMLElement>("[role='alert'], [aria-live='assertive']");
          if (invalid && isTextField(invalid)) guideToCaret(invalid);
          else if (alert?.textContent?.trim()) {
            const field = lastValidationForm.querySelector<HTMLInputElement | HTMLTextAreaElement>("input:invalid, textarea:invalid, [aria-invalid='true']");
            if (field) guideToCaret(field);
            else guidedTarget = null;
          } else guidedTarget = null;
          if (!guidedTarget) firefly.classList.remove("naxa-luciole-guidance-pulse", "naxa-luciole-typing-glow");
          lastValidationForm = null;
        }, 450);
      } else {
        guidedTarget = null;
        firefly.classList.remove("naxa-luciole-guidance-pulse");
      }
    };
    const onGuidanceInvalid = (event: Event) => {
      if (!isTextField(event.target)) return;
      if (invalidFocusTimer) window.clearTimeout(invalidFocusTimer);
      invalidFocusTimer = window.setTimeout(() => { if (isTextField(event.target)) guideToCaret(event.target); invalidFocusTimer = undefined; }, 0);
    };
    const onResize = () => {
      placeTree();
      if (guidedTarget?.kind === "caret" && guidedTarget.field) guideToCaret(guidedTarget.field);
      else if (guidedTarget?.kind === "button" && document.activeElement instanceof HTMLElement && document.activeElement.matches("button, input[type=submit], input[type=button], [role=button]")) guideToButton(document.activeElement);
      start();
    };
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

      if (idleFor >= 20_000) {
        resting = true;
        targetX = treeX;
        targetY = treeY - 12;
        tree.classList.remove("naxa-luciole-tree-awake");
      } else {
        resting = false;
        if (idleFor >= 1600) {
          // Chaque destination est tirée indépendamment dans toute la zone visible :
          // aucune sinusoïde, boucle ni trajectoire répétitive.
          if (now >= nextWanderAt) {
            const point = randomViewportPoint();
            nextWanderX = point.x;
            nextWanderY = point.y;
            nextWanderAt = now + 1400 + Math.random() * 3000;
          }
          targetX = nextWanderX;
          targetY = nextWanderY;
        }
      }

      if (guidedTarget) {
        if (guidedTarget.kind === "caret" && guidedTarget.field) {
          if (document.activeElement === guidedTarget.field) {
            const latest = caretTarget(guidedTarget.field);
            guidedTarget = { ...latest, form: guidedTarget.form };
          } else if (!(document.activeElement instanceof HTMLElement && document.activeElement.matches("button, input[type=submit], input[type=button], [role=button]"))) {
            guidedTarget = null;
            firefly.classList.remove("naxa-luciole-guidance-pulse", "naxa-luciole-typing-glow");
          }
        }
        if (guidedTarget) {
          targetX = guidedTarget.x;
          targetY = guidedTarget.y;
          if (now > guideGlowUntil) firefly.classList.remove("naxa-luciole-typing-glow");
          if (now > guidePulseUntil && guidedTarget.kind === "caret") firefly.classList.remove("naxa-luciole-guidance-pulse");
          else firefly.classList.add("naxa-luciole-guidance-pulse");
        }
      }
      const ease = resting ? 0.055 : 0.085;
      vx = (vx + (targetX - x) * ease) * 0.78;
      vy = (vy + (targetY - y) * ease) * 0.78;
      x += vx;
      y += vy;
      paint();

      const settled = Math.abs(targetX - x) < 0.8 && Math.abs(targetY - y) < 0.8 && Math.abs(vx) + Math.abs(vy) < 0.35;
      if (!settled || !resting || idleFor < 20_000) frameId = requestAnimationFrame(tick);
      else {
        firefly.classList.add("naxa-luciole-resting");
        tree.classList.add("naxa-luciole-tree-glow");
      }
    };

    function start() {
      if (!firefly || !tree) return;
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
    if (motionAllowed) {
      document.addEventListener("focusin", onGuidanceFocusIn, true);
      document.addEventListener("focusout", onGuidanceFocusOut, true);
      document.addEventListener("input", onGuidanceInput, true);
      document.addEventListener("keyup", onGuidanceSelection, true);
      document.addEventListener("selectionchange", onGuidanceSelectionChange);
      document.addEventListener("pointerdown", onGuidancePointerDown, { passive: true, capture: true });
      document.addEventListener("click", onGuidanceClick, true);
      document.addEventListener("invalid", onGuidanceInvalid, true);
      document.addEventListener("pointermove", onGuidancePointerMove, { passive: true, capture: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onResize, { passive: true, capture: true });

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onInteraction);
      document.removeEventListener("keydown", onInteraction);
      document.removeEventListener("focusin", onInteraction);
      document.removeEventListener("focusin", onGuidanceFocusIn, true);
      document.removeEventListener("focusout", onGuidanceFocusOut, true);
      document.removeEventListener("input", onGuidanceInput, true);
      document.removeEventListener("keyup", onGuidanceSelection, true);
      document.removeEventListener("selectionchange", onGuidanceSelectionChange);
      document.removeEventListener("pointerdown", onGuidancePointerDown, true);
      document.removeEventListener("click", onGuidanceClick, true);
      document.removeEventListener("invalid", onGuidanceInvalid, true);
      document.removeEventListener("pointermove", onGuidancePointerMove, true);
      if (validationTimer) window.clearTimeout(validationTimer);
      if (clickSparkTimer) window.clearTimeout(clickSparkTimer);
      if (invalidFocusTimer) window.clearTimeout(invalidFocusTimer);
      firefly.classList.remove("naxa-luciole-guidance-pulse", "naxa-luciole-typing-glow", "naxa-luciole-click-spark");
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
        <svg className="luciole-anatomy" viewBox="0 0 48 48" aria-hidden="true">
          <defs>
            <linearGradient id="luciole-wing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F4FFF9" stopOpacity=".92" />
              <stop offset=".55" stopColor="#A9FFD7" stopOpacity=".48" />
              <stop offset="1" stopColor="#8AF5C2" stopOpacity=".08" />
            </linearGradient>
            <radialGradient id="luciole-abdomen">
              <stop offset="0" stopColor="#FFFBE0" />
              <stop offset=".42" stopColor="#FFE36A" />
              <stop offset="1" stopColor="#F5A623" stopOpacity=".2" />
            </radialGradient>
          </defs>
          <ellipse className="luciole-wing luciole-wing-left" cx="18" cy="17" rx="10" ry="4.4" transform="rotate(-38 18 17)" />
          <ellipse className="luciole-wing luciole-wing-right" cx="28" cy="17" rx="10" ry="4.4" transform="rotate(38 28 17)" />
          <path className="luciole-wing-vein" d="M11 21 20 14M37 21 28 14" />
          <ellipse className="luciole-thorax" cx="24" cy="23" rx="4.1" ry="5.2" />
          <circle className="luciole-head" cx="24" cy="17.8" r="3.1" />
          <path className="luciole-antenna" d="M22 15.5 19.4 12M26 15.5 28.6 12" />
          <ellipse className="luciole-abdomen" cx="24" cy="30" rx="4.4" ry="7" />
          <ellipse className="luciole-glow-core" cx="24" cy="32" rx="2.8" ry="4.2" />
        </svg>
        <span className="luciole-core" />
        {Array.from({ length: SPARKS }, (_, i) => <i key={i} className="luciole-spark" />)}
      </div>
    </>
  );
}
