"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { LUCIOLE_TIMING } from "@/components/luciole-constants";

const SPARKS = 8;

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
    let pendingBusinessGesture: string | null = null;
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
      clearBusinessGesture();
      wake();
      guidedTarget = caretTarget(field);
      guidePulseUntil = performance.now() + LUCIOLE_TIMING.guidePulse;
      if (glow) { guideGlowUntil = performance.now() + LUCIOLE_TIMING.typingGlow; firefly.classList.add("naxa-luciole-typing-glow"); }
      lastInput = performance.now();
      resting = false;
      tree.classList.add("naxa-luciole-tree-awake");
      start();
    };
    const guideToButton = (button: HTMLElement) => {
      clearBusinessGesture();
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
    const FAIRY_EVENTS = new Set(["reminder", "search", "scan", "cart", "order", "reservation", "payment", "favorite", "language", "offline", "online"]);
    const clearBusinessGesture = () => {
      pendingBusinessGesture = null;
      if (businessGestureTimer) window.clearTimeout(businessGestureTimer);
      businessGestureTimer = undefined;
      firefly.classList.remove(...Array.from(FAIRY_EVENTS, (name) => "luciole-event-" + name));
      businessGesture = null;
    };
    const reactToBusinessEvent = (type: string) => {
      if (!FAIRY_EVENTS.has(type)) return;
      // Les événements métier attendent le calme : le suivi du doigt et de la saisie garde la priorité.
      pendingBusinessGesture = type;
      wake();
      lastInput = performance.now();
      nextSpecialAt = lastInput + LUCIOLE_TIMING.specialIntervalMin + Math.random() * (LUCIOLE_TIMING.specialIntervalMax - LUCIOLE_TIMING.specialIntervalMin);
      start();
    };
    const onCartAdded = () => reactToBusinessEvent("cart");
    const onFavoritesChanged = () => reactToBusinessEvent("favorite");
    const onLanguageChanged = () => reactToBusinessEvent("language");
    const onOffline = () => reactToBusinessEvent("offline");
    const onOnline = () => reactToBusinessEvent("online");
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
    const triggerRandomSpecial = (now: number) => {
      const choices = ["sit", "yawn", "teleport"] as const;
      const choice = choices[Math.floor(Math.random() * choices.length)];
      const className = choice === "sit" ? "luciole-sitting" : choice === "yawn" ? "luciole-yawning" : "luciole-teleporting";
      clearRandomSpecial();
      firefly.classList.add(className);
      if (choice === "teleport") {
        teleportTimer = window.setTimeout(() => {
          const point = randomViewportPoint();
          x = point.x; y = point.y; targetX = point.x; targetY = point.y; vx = 0; vy = 0;
          paint();
          teleportTimer = undefined;
        }, Math.min(LUCIOLE_TIMING.teleportRelocation, LUCIOLE_TIMING.teleportFade / 2));
        specialTimer = window.setTimeout(() => {
          firefly.classList.remove(className);
          specialTimer = undefined;
        }, LUCIOLE_TIMING.teleportFade);
      } else {
        const duration = choice === "sit"
          ? LUCIOLE_TIMING.sitMin + Math.random() * (LUCIOLE_TIMING.sitMax - LUCIOLE_TIMING.sitMin)
          : LUCIOLE_TIMING.yawn;
        specialTimer = window.setTimeout(() => {
          firefly.classList.remove(className);
          specialTimer = undefined;
        }, duration);
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
        spark.style.animation = `luciole-spark ${LUCIOLE_TIMING.sparkDuration}ms ease-out forwards`;
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      clearBusinessGesture();
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
      clearBusinessGesture();
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
      clickSparkTimer = window.setTimeout(() => { firefly.classList.remove("naxa-luciole-click-spark"); clickSparkTimer = undefined; }, reducedMotion.matches ? 0 : LUCIOLE_TIMING.clickSpark);
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
        }, LUCIOLE_TIMING.validationDelay);
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
      if (pendingBusinessGesture && idleFor >= LUCIOLE_TIMING.specialCalm && guidedTarget?.kind !== "caret" && !sleeping && !sleepPending) {
        const type = pendingBusinessGesture;
        pendingBusinessGesture = null;
        firefly.classList.remove(...Array.from(FAIRY_EVENTS, (name) => "luciole-event-" + name));
        businessGesture = type;
        firefly.classList.add("luciole-event-" + type);
        if (businessGestureTimer) window.clearTimeout(businessGestureTimer);
        businessGestureTimer = window.setTimeout(() => {
          firefly.classList.remove("luciole-event-" + type);
          businessGesture = null;
          businessGestureTimer = undefined;
        }, LUCIOLE_TIMING.specialMaxFinish);
      }
      if (!sleeping && !sleepPending && !guidedTarget && idleFor >= LUCIOLE_TIMING.specialCalm && idleFor < LUCIOLE_TIMING.inactivity && now >= nextSpecialAt && !businessGesture && !pendingBusinessGesture) triggerRandomSpecial(now);
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
        if (idleFor >= LUCIOLE_TIMING.randomWanderStart) {
          // Chaque destination est tirée indépendamment dans toute la zone visible :
          // aucune sinusoïde, boucle ni trajectoire répétitive.
          if (now >= nextWanderAt) {
            const point = randomViewportPoint();
            nextWanderX = point.x;
            nextWanderY = point.y;
            nextWanderAt = now + LUCIOLE_TIMING.wanderLegMin + Math.random() * LUCIOLE_TIMING.wanderLegRange;
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
      saluteUntil = performance.now() + LUCIOLE_TIMING.saluteDuration;
      firefly.classList.add("gesture-salute");
      activeGesture = "salute";
      saluteTimer = window.setTimeout(() => { firefly.classList.remove("gesture-salute"); saluteTimer = undefined; }, LUCIOLE_TIMING.saluteCleanup);
    }
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
    document.addEventListener("naxa:fairy", onNaxaFairyEvent as EventListener);
    window.addEventListener("naxa:panier-ajoute", onCartAdded);
    window.addEventListener("naxa:favoris-change", onFavoritesChanged);
    window.addEventListener("naxa-language-updated", onLanguageChanged);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
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
      if (tickleTimer) window.clearTimeout(tickleTimer);
      clearRandomSpecial();
      if (businessGestureTimer) window.clearTimeout(businessGestureTimer);
      firefly.classList.remove(...Array.from(FAIRY_EVENTS, (name) => "luciole-event-" + name));
      firefly.classList.remove("naxa-luciole-guidance-pulse", "naxa-luciole-typing-glow", "naxa-luciole-click-spark");
      document.removeEventListener("naxa:fairy", onNaxaFairyEvent as EventListener);
      window.removeEventListener("naxa:panier-ajoute", onCartAdded);
      window.removeEventListener("naxa:favoris-change", onFavoritesChanged);
      window.removeEventListener("naxa-language-updated", onLanguageChanged);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
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
              <stop offset="0" stopColor="#FFFDF5" stopOpacity=".52" />
              <stop offset=".48" stopColor="#D9F4FF" stopOpacity=".40" />
              <stop offset=".76" stopColor="#FFDDE9" stopOpacity=".34" />
              <stop offset="1" stopColor="#FFE8A6" stopOpacity=".28" />
            </linearGradient>
            <linearGradient id="luciole-wing-edge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFFDF2" stopOpacity=".98" />
              <stop offset=".52" stopColor="#D8F4FF" stopOpacity=".9" />
              <stop offset="1" stopColor="#FFE1A0" stopOpacity=".94" />
            </linearGradient>
            <linearGradient id="luciole-dress" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFF9E9" />
              <stop offset=".55" stopColor="#E3F4FF" stopOpacity=".96" />
              <stop offset="1" stopColor="#FFE4A0" stopOpacity=".72" />
            </linearGradient>
            <radialGradient id="luciole-fairy-light" cx=".5" cy=".72" r=".58">
              <stop offset="0" stopColor="#FFE6A0" stopOpacity=".9" />
              <stop offset=".5" stopColor="#FFD76A" stopOpacity=".3" />
              <stop offset="1" stopColor="#FFD76A" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g className="luciole-wings">
            <path className="luciole-wing luciole-wing-upper-left" d="M21 23 C16 17 9 11 7 3 C15 4 21 9 23 17 C24 19 23 22 21 23Z" />
            <path className="luciole-wing luciole-wing-upper-right" d="M27 23 C32 17 39 11 41 3 C33 4 27 9 25 17 C24 19 25 22 27 23Z" />
            <path className="luciole-wing luciole-wing-lower-left" d="M20 24 C14 22 8 23 6 28 C9 34 15 35 21 29Z" />
            <path className="luciole-wing luciole-wing-lower-right" d="M28 24 C34 22 40 23 42 28 C39 34 33 35 27 29Z" />
            <g className="luciole-wing-lace">
              <path d="M21 22 Q14 12 8 5 M21 21 Q16 16 12 14 M17 16 Q14 10 13 8 M27 22 Q34 12 40 5 M27 21 Q32 16 36 14 M31 16 Q34 10 35 8" />
              <path d="M20 28 Q13 25 7 27 M20 28 Q15 30 13 32 M28 28 Q35 25 41 27 M28 28 Q33 30 35 32" />
              <ellipse cx="15" cy="12" rx="1.8" ry="2.5" />
              <ellipse cx="33" cy="12" rx="1.8" ry="2.5" />
              <ellipse cx="13" cy="28" rx="1.7" ry="1.2" />
              <ellipse cx="35" cy="28" rx="1.7" ry="1.2" />
            </g>
          </g>
          <ellipse className="luciole-fairy-aura" cx="24" cy="31" rx="12" ry="15" />
          <g className="luciole-fairy-body">
            <path className="luciole-dress" d="M22 22 Q24 20 26 22 L27 28 Q30 32 33 39 Q28 42 24 39 Q20 43 15 39 Q19 32 21 28Z" />
            <path className="luciole-dress-fold" d="M23 25 Q22 31 18 38 M25 25 Q27 32 29 39 M24 28 L24 39" />
            <path className="luciole-neck" d="M23 21 L23 23 M25 21 L25 23" />
            <path className="luciole-face" d="M21 15 Q21 11 24 11 Q28 12 27 17 Q26 21 23 21 Q20 19 21 15Z" />
            <path className="luciole-hair" d="M20.5 16 Q19 10 23 9 Q28 8 28 14 L26.5 16 Q26 12 23 12 Q22 15 20.5 16Z" />
            <circle className="luciole-bun" cx="27.5" cy="9.5" r="2.1" />
            <path className="luciole-hair-stray" d="M21 12 Q18 11 19 8 M27 13 Q30 12 29.5 10" />
            <path className="luciole-face-detail" d="M25.4 16.5 Q26 16.8 25.5 17.1" />
          </g>
          <g className="luciole-arm luciole-arm-back">
            <path className="luciole-arm-line" d="M21 23 Q18 24 17 27 L14 28" />
            <path className="luciole-hand" d="M14.5 27.4 Q12.5 26.8 12 28.2 Q13 29.7 14.8 28.8Z" />
          </g>
          <g className="luciole-arm luciole-arm-front">
            <path className="luciole-arm-line" d="M26 23 Q29 22 30 19 L33 17" />
            <path className="luciole-hand" d="M32.5 17.3 Q33.5 15.4 35 16.1 Q35.7 17.6 33.4 18.4Z" />
          </g>
          <g className="luciole-sleep-z" aria-hidden="true">
            <path className="luciole-sleep-z-one" d="M28 10h3l-3 3h3" />
            <path className="luciole-sleep-z-two" d="M32 6h3l-3 3h3" />
            <path className="luciole-sleep-z-three" d="M36 2h3l-3 3h3" />
          </g>
          <ellipse className="luciole-glow-core" cx="24" cy="36" rx="3.1" ry="5.2" />
        </svg>
        <span className="luciole-core" />
        {Array.from({ length: SPARKS }, (_, i) => <i key={i} className="luciole-spark" />)}
      </div>
    </>
  );
}
