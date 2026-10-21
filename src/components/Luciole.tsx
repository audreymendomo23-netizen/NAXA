"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { LUCIOLE_TIMING } from "@/components/luciole-constants";

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
    let saluteTimer: number | undefined;
    let saluteUntil = 0;
    let activeGesture: string | null = null;
    let sleeping = false;
    let sleepPending = false;
    let lastTapAt = 0;
    let tickleCooldownUntil = 0;
    let tickleTimer: number | undefined;
    let specialTimer: number | undefined;
    let teleportTimer: number | undefined;
    let businessGestureTimer: number | undefined;
    let nextSpecialAt = performance.now() + LUCIOLE_TIMING.specialFirstMin + Math.random() * (LUCIOLE_TIMING.specialFirstMax - LUCIOLE_TIMING.specialFirstMin);
    let businessGesture: string | null = null;
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
    const wake = () => {
      if (!sleeping && !sleepPending) return;
      sleeping = false; sleepPending = false;
      firefly.classList.remove("luciole-sleeping", "luciole-sleep-arriving");
      tree.classList.add("naxa-luciole-tree-awake");
      lastInput = performance.now(); resting = false; start();
    };
    const guideToCaret = (field: HTMLInputElement | HTMLTextAreaElement, glow = false) => {
      wake();
      guidedTarget = caretTarget(field);
      guidePulseUntil = performance.now() + 650;
      if (glow) { guideGlowUntil = performance.now() + 480; firefly.classList.add("naxa-luciole-typing-glow"); }
      lastInput = performance.now();
      resting = false;
      tree.classList.add("naxa-luciole-tree-awake");
      start();
    };
    const guideToButton = (button: HTMLElement) => {
      wake();
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
    const FAIRY_EVENTS = new Set(["reminder", "search", "scan", "cart", "order", "reservation", "payment"]);
    const reactToBusinessEvent = (type: string) => {
      if (!FAIRY_EVENTS.has(type)) return;
      firefly.classList.remove(...Array.from(FAIRY_EVENTS, (name) => "luciole-event-" + name));
      businessGesture = type;
      firefly.classList.add("luciole-event-" + type);
      if (businessGestureTimer) window.clearTimeout(businessGestureTimer);
      businessGestureTimer = window.setTimeout(() => {
        firefly.classList.remove("luciole-event-" + type);
        businessGesture = null;
        businessGestureTimer = undefined;
      }, LUCIOLE_TIMING.specialMaxFinish);
      wake();
      lastInput = performance.now();
      nextSpecialAt = lastInput + LUCIOLE_TIMING.specialIntervalMin + Math.random() * (LUCIOLE_TIMING.specialIntervalMax - LUCIOLE_TIMING.specialIntervalMin);
      start();
    };
    const onNaxaFairyEvent = (event: Event) => {
      const detail = (event as CustomEvent<string | { type?: string }>).detail;
      const type = typeof detail === "string" ? detail : detail?.type;
      if (type) reactToBusinessEvent(type);
    };
    const reactToClickedControl = (button: HTMLElement) => {
      const signal = [
        button.getAttribute("data-naxa-fairy") ?? "",
        button.getAttribute("aria-label") ?? "",
        button.getAttribute("href") ?? "",
        button.textContent ?? "",
      ].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const type =
        /scanner|scan|ordonnance/.test(signal) ? "scan" :
        /paiement|payer|checkout|payment/.test(signal) ? "payment" :
        /panier/.test(signal) ? "cart" :
        /commande|achat|reservation/.test(signal) ? "order" :
        /rappel|posologie|traitement/.test(signal) ? "reminder" :
        /recherche|chercher|search|medicament/.test(signal) ? "search" : null;
      if (type) reactToBusinessEvent(type);
    };
    const clearRandomSpecial = () => {
      if (specialTimer) window.clearTimeout(specialTimer);
      if (teleportTimer) window.clearTimeout(teleportTimer);
      specialTimer = undefined; teleportTimer = undefined;
      firefly.classList.remove("luciole-sitting", "luciole-yawning", "luciole-teleporting");
    };
    let fairyTimer: number | undefined;
    let fairyVisible = false;
    let lastFairyTouchAt = 0;
    let fairyTouchCount = 0;
    const returnToFirefly = () => {
      if (!fairyVisible) return;
      fairyVisible = false;
      if (fairyTimer) window.clearTimeout(fairyTimer);
      fairyTimer = undefined;
      firefly.classList.remove("luciole-fairy-entering", "luciole-fairy-visible");
      firefly.classList.add("luciole-fairy-leaving");
      window.setTimeout(() => firefly.classList.remove("luciole-fairy-leaving"), LUCIOLE_TIMING.fairyFade);
    };
    const transformToFairy = () => {
      if (sleeping || sleepPending || guidedTarget || businessGesture || fairyVisible || !motionAllowed) return;
      clearRandomSpecial();
      fairyVisible = true;
      firefly.classList.remove("luciole-fairy-leaving");
      firefly.classList.add("luciole-fairy-entering");
      burst();
      window.setTimeout(() => { if (fairyVisible) { firefly.classList.remove("luciole-fairy-entering"); firefly.classList.add("luciole-fairy-visible"); } }, LUCIOLE_TIMING.fairyFade);
      fairyTimer = window.setTimeout(returnToFirefly, LUCIOLE_TIMING.fairyDuration - LUCIOLE_TIMING.fairyFade);
    };
    const onFairyTripleTouch = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || sleeping || sleepPending) return;
      const rect = firefly.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      const now = performance.now();
      if (now - lastFairyTouchAt > LUCIOLE_TIMING.tripleTouchWindow) fairyTouchCount = 0;
      lastFairyTouchAt = now; fairyTouchCount += 1;
      if (fairyTouchCount >= 3) { fairyTouchCount = 0; transformToFairy(); }
    };
    const triggerRandomSpecial = (now: number) => {
      const choice = Math.floor(Math.random() * 4);
      if (choice === 3) transformToFairy();
      else {
        const className = choice === 0 ? "luciole-sitting" : choice === 1 ? "luciole-yawning" : "luciole-teleporting";
        clearRandomSpecial(); firefly.classList.add(className);
        if (choice === 2) {
          teleportTimer = window.setTimeout(() => { const point = randomViewportPoint(); x = point.x; y = point.y; targetX = point.x; targetY = point.y; vx = 0; vy = 0; paint(); teleportTimer = undefined; }, Math.min(300, LUCIOLE_TIMING.teleportFade / 2));
          specialTimer = window.setTimeout(() => { firefly.classList.remove(className); specialTimer = undefined; }, LUCIOLE_TIMING.teleportFade);
        } else {
          const duration = choice === 0 ? LUCIOLE_TIMING.sitMin + Math.random() * (LUCIOLE_TIMING.sitMax - LUCIOLE_TIMING.sitMin) : LUCIOLE_TIMING.yawn;
          specialTimer = window.setTimeout(() => { firefly.classList.remove(className); specialTimer = undefined; }, duration);
        }
      }
      nextSpecialAt = now + LUCIOLE_TIMING.specialIntervalMin + Math.random() * (LUCIOLE_TIMING.specialIntervalMax - LUCIOLE_TIMING.specialIntervalMin);
    };
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
      if (fairyVisible && event.pointerType === "mouse") returnToFirefly();
      wake();
      clearRandomSpecial();
      if (event.pointerType === "mouse" && event.buttons === 0) {
        // La luciole suit aussi le curseur sur ordinateur, sans capter les interactions.
      }
      lastInput = performance.now();
      nextSpecialAt = lastInput + LUCIOLE_TIMING.specialFirstMin + Math.random() * (LUCIOLE_TIMING.specialFirstMax - LUCIOLE_TIMING.specialFirstMin);
      resting = false;
      targetX = event.clientX;
      targetY = event.clientY;
      nextWanderAt = 0;
      tree.classList.add("naxa-luciole-tree-awake");
      start();
    };
    const onInteraction = (event: Event) => {
      returnToFirefly();
      const now = performance.now();
      clearRandomSpecial();
      nextSpecialAt = now + LUCIOLE_TIMING.specialFirstMin + Math.random() * (LUCIOLE_TIMING.specialFirstMax - LUCIOLE_TIMING.specialFirstMin);
      const pointer = event as PointerEvent;
      if (event.type === "pointerdown") {
        const inside = Math.hypot(pointer.clientX - x, pointer.clientY - y) <= 24;
        const target = event.target instanceof Element ? event.target.closest("button,a,input,textarea,select,[role=button],label,[contenteditable=true]") : null;
        if (inside && !target && now - lastTapAt <= LUCIOLE_TIMING.doubleTap && now >= tickleCooldownUntil) {
          firefly.classList.remove("luciole-sleeping");
          firefly.classList.add("luciole-tickling");
          firefly.style.setProperty("--luciole-tickle-duration", LUCIOLE_TIMING.tickle + "ms");
          tickleCooldownUntil = now + LUCIOLE_TIMING.tickle + LUCIOLE_TIMING.tickleCooldown;
          if (tickleTimer) window.clearTimeout(tickleTimer);
          tickleTimer = window.setTimeout(() => {
            firefly.classList.remove("luciole-tickling");
            tickleTimer = undefined;
          }, LUCIOLE_TIMING.tickle);
          burst();
        }
        lastTapAt = inside && !target ? now : 0;
      }
      wake();
      lastInput = now;
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
      const button = element instanceof HTMLElement ? element.closest<HTMLElement>("a[href], button, input[type=submit], input[type=button], [role=button]") : null;
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
      const button = element instanceof HTMLElement ? element.closest<HTMLElement>("a[href], button, input[type=submit], input[type=button], [role=button]") : null;
      if (!button) return;
      burst();
      firefly.classList.add("naxa-luciole-click-spark");
      if (clickSparkTimer) window.clearTimeout(clickSparkTimer);
      clickSparkTimer = window.setTimeout(() => { firefly.classList.remove("naxa-luciole-click-spark"); clickSparkTimer = undefined; }, reducedMotion.matches ? 0 : 360);
      reactToClickedControl(button);
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
      if (saluteTimer) window.clearTimeout(saluteTimer);
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
      if (!sleeping && !sleepPending && !guidedTarget && idleFor >= LUCIOLE_TIMING.specialCalm && idleFor < LUCIOLE_TIMING.inactivity && now >= nextSpecialAt && !businessGesture) triggerRandomSpecial(now);
      const nextGesture = sleeping || sleepPending ? "resting" : businessGesture ? "dance" : now < saluteUntil ? "salute" : guidedTarget?.kind === "caret" ? "typing" : guidedTarget?.kind === "button" ? "pointing" : idleFor >= LUCIOLE_TIMING.inactivity ? "resting" : "dance";
      if (nextGesture !== activeGesture) {
        firefly.classList.remove("gesture-salute", "gesture-dance", "gesture-typing", "gesture-pointing", "gesture-resting");
        firefly.classList.add("gesture-" + nextGesture);
        activeGesture = nextGesture;
      }

      if (idleFor >= LUCIOLE_TIMING.inactivity) {
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
      const ease = sleepPending || idleFor >= LUCIOLE_TIMING.inactivity ? 0.12 : resting ? 0.055 : 0.085;
      vx = (vx + (targetX - x) * ease) * 0.78;
      vy = (vy + (targetY - y) * ease) * 0.78;
      x += vx;
      y += vy;
      paint();
      if (idleFor >= LUCIOLE_TIMING.inactivity && !sleeping && !sleepPending && !guidedTarget) {
        sleepPending = true;
        firefly.classList.add("luciole-sleep-arriving");
        targetX = treeX; targetY = treeY - 12;
      }
      if (sleepPending && Math.hypot(targetX - x, targetY - y) < 1.5 && Math.abs(vx) + Math.abs(vy) < 0.6) {
        sleepPending = false; sleeping = true;
        firefly.classList.remove("luciole-sleep-arriving");
        firefly.classList.add("luciole-sleeping");
        tree.classList.remove("naxa-luciole-tree-awake");
        tree.classList.add("naxa-luciole-tree-glow");
      }

      const settled = Math.abs(targetX - x) < 0.8 && Math.abs(targetY - y) < 0.8 && Math.abs(vx) + Math.abs(vy) < 0.35;
      if (!settled || !resting || idleFor < LUCIOLE_TIMING.inactivity || !sleeping) frameId = requestAnimationFrame(tick);
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

    firefly.style.setProperty("--luciole-wing-duration", LUCIOLE_TIMING.wingBeat + "ms");
    firefly.style.setProperty("--luciole-sleep-breath-duration", LUCIOLE_TIMING.sleepBreath + "ms");
    firefly.style.setProperty("--luciole-z-cycle-duration", LUCIOLE_TIMING.sleepZCycle + "ms");
    firefly.style.setProperty("--luciole-tickle-duration", LUCIOLE_TIMING.tickle + "ms");
    placeTree();
    paint();
    if (motionAllowed) {
      saluteUntil = performance.now() + 1150;
      firefly.classList.add("gesture-salute");
      activeGesture = "salute";
      saluteTimer = window.setTimeout(() => { firefly.classList.remove("gesture-salute"); saluteTimer = undefined; }, 1200);
    }
    if (!reducedMotion.matches) start();
    else {
      x = targetX;
      y = targetY;
      paint();
    }

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerdown", onInteraction, { passive: true });
    document.addEventListener("pointerdown", onFairyTripleTouch, { passive: true });
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
    document.addEventListener("naxa:fairy", onNaxaFairyEvent as EventListener);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onResize, { passive: true, capture: true });

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onInteraction);
      document.removeEventListener("pointerdown", onFairyTripleTouch);
      if (fairyTimer) window.clearTimeout(fairyTimer);
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
      if (tickleTimer) window.clearTimeout(tickleTimer);
      clearRandomSpecial();
      if (businessGestureTimer) window.clearTimeout(businessGestureTimer);
      firefly.classList.remove(...Array.from(FAIRY_EVENTS, (name) => "luciole-event-" + name));
      firefly.classList.remove("naxa-luciole-guidance-pulse", "naxa-luciole-typing-glow", "naxa-luciole-click-spark");
      document.removeEventListener("naxa:fairy", onNaxaFairyEvent as EventListener);
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
        <svg className="luciole-anatomy luciole-insect" viewBox="0 0 48 48" aria-hidden="true">
          <defs><linearGradient id="luciole-wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F4FFF9" stopOpacity=".92" /><stop offset=".55" stopColor="#A9FFD7" stopOpacity=".48" /><stop offset="1" stopColor="#8AF5C2" stopOpacity=".08" /></linearGradient><radialGradient id="luciole-abdomen"><stop offset="0" stopColor="#FFFBE0" /><stop offset=".42" stopColor="#FFE36A" /><stop offset="1" stopColor="#F5A623" stopOpacity=".2" /></radialGradient></defs>
          <ellipse className="luciole-wing luciole-wing-left" cx="18" cy="17" rx="10" ry="4.4" transform="rotate(-38 18 17)" /><ellipse className="luciole-wing luciole-wing-right" cx="28" cy="17" rx="10" ry="4.4" transform="rotate(38 28 17)" /><path className="luciole-wing-vein" d="M11 21 20 14M37 21 28 14" />
          <ellipse className="luciole-thorax" cx="24" cy="23" rx="4.1" ry="5.2" /><circle className="luciole-head" cx="24" cy="17.8" r="3.1" /><path className="luciole-antenna" d="M22 15.5 19.4 12M26 15.5 28.6 12" /><ellipse className="luciole-abdomen" cx="24" cy="30" rx="4.4" ry="7" /><ellipse className="luciole-glow-core" cx="24" cy="32" rx="2.8" ry="4.2" />
        </svg>
        <svg className="luciole-anatomy luciole-fairy" viewBox="0 0 48 48" aria-hidden="true">
          <defs>
            <linearGradient id="luciole-fairy-wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".98" /><stop offset=".48" stopColor="#B7F5F0" stopOpacity=".82" /><stop offset="1" stopColor="#D7B8FF" stopOpacity=".34" /></linearGradient>
            <linearGradient id="luciole-fairy-hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF4A8" /><stop offset=".55" stopColor="#E8B94E" /><stop offset="1" stopColor="#A96B20" /></linearGradient>
            <linearGradient id="luciole-fairy-jacket" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#16834D" /><stop offset="1" stopColor="#064526" /></linearGradient>
          </defs>
          <g className="luciole-fairy-wings" stroke="#E7C66A" strokeWidth=".42">
            <path d="M22 17C16 7 8 3 6 7c-2 4 3 10 14 13Z" fill="url(#luciole-fairy-wing)" /><path d="M26 17C32 7 40 3 42 7c2 4-3 10-14 13Z" fill="url(#luciole-fairy-wing)" /><path d="M22 20C13 14 6 15 7 20c1 4 7 6 14 5Z" fill="url(#luciole-fairy-wing)" /><path d="M26 20C35 14 42 15 41 20c-1 4-7 6-14 5Z" fill="url(#luciole-fairy-wing)" /><path d="M23 18 8 7M23 19 8 19M25 18 40 7M25 19 40 19" fill="none" strokeOpacity=".85" />
          </g>
          <g className="luciole-fairy-halo" fill="none" stroke="#FFD95C" strokeWidth=".65"><ellipse cx="24" cy="4.1" rx="7.2" ry="1.7" /><ellipse cx="24" cy="4.1" rx="5.2" ry="1.15" strokeOpacity=".82" /><ellipse cx="24" cy="4.1" rx="3.1" ry=".7" strokeOpacity=".68" /></g>
          <path d="M19 10C16 12 17 19 18 24L18.5 30 20 31 21 22 21 13ZM29 10C32 12 31 19 30 24L29.5 30 28 31 27 22 27 13Z" fill="url(#luciole-fairy-hair)" stroke="#C58B2C" strokeWidth=".45" />
          <circle cx="24" cy="11.2" r="5" fill="#8C5139" /><path d="M19.5 10.5C19 7.3 21.2 6 24 6s5 1.4 4.5 4.5c-1.8-1-2.8-2.2-3.3-3.2-1.5 1.9-3.1 2.8-5.7 3.2Z" fill="url(#luciole-fairy-hair)" /><path d="M19.2 9.2Q24 6.6 28.8 9.2L28.4 10.3Q24 8.5 19.6 10.3Z" fill="#FFE23D" />
          <ellipse cx="22" cy="11.2" rx="2" ry="1.8" fill="none" stroke="#E8E7DC" strokeWidth=".65" /><ellipse cx="26" cy="11.2" rx="2" ry="1.8" fill="none" stroke="#E8E7DC" strokeWidth=".65" /><path d="M24 11.2h.1" stroke="#E8E7DC" strokeWidth=".8" /><circle cx="22" cy="11.2" r=".4" fill="#242424" /><circle cx="26" cy="11.2" r=".4" fill="#242424" /><path d="M22 13.2Q24 14.5 26 13.2" fill="none" stroke="#6B3026" strokeWidth=".55" strokeLinecap="round" />
          <g className="luciole-fairy-body" strokeLinecap="round" strokeLinejoin="round">
            <path className="luciole-arm-back" d="M21 16 15 19 11 17" fill="none" stroke="#8C5139" strokeWidth="1.8" /><path className="luciole-arm-front" d="M27 16 33 19 37 17" fill="none" stroke="#8C5139" strokeWidth="1.8" />
            <path d="M20 15.5 17.5 17.3 19.3 24 28.7 24 30.5 17.3 28 15.5 26 17 22 17Z" fill="url(#luciole-fairy-jacket)" stroke="#0B4A2A" strokeWidth=".45" /><path d="M22 16.5 24 19 26 16.5 27 23.8 21 23.8Z" fill="#FFFFFF" />
            <text x="24" y="21.5" textAnchor="middle" fontSize="2.55" fontWeight="800" fill="#FFE23D">N<tspan fill="#16834D">AXA</tspan></text>
            <path d="M19.3 23.5 28.7 23.5 30 30 18 30Z" fill="#FFFFFF" stroke="#D8D8D8" strokeWidth=".4" /><path d="M18 29.5 30 29.5 28.8 31.5 19.2 31.5Z" fill="#FFFFFF" stroke="#D8D8D8" strokeWidth=".4" /><path d="M19.2 31.5 28.8 31.5 27.5 33 20.5 33Z" fill="#FFFFFF" /><path d="M19.1 31.5 28.9 31.5" stroke="#E8C45D" strokeWidth=".7" />
            <path d="M21 33 22 40M27 33 26 40" stroke="#8C5139" strokeWidth="1.1" strokeLinecap="round" /><path d="M21.4 39.6 21.1 41.5M26.6 39.6 26.9 41.5" stroke="#8C5139" strokeWidth=".85" strokeLinecap="round" />
          </g>
          <circle className="luciole-glow-core" cx="24" cy="24" r="2.4" fill="#FFE78A" opacity=".18" />
        </svg>
        <span className="luciole-core" />
        {Array.from({ length: SPARKS }, (_, i) => <i key={i} className="luciole-spark" />)}
      </div>
    </>
  );
}
