"use client";
export type ScrollMotionMode = "cinematic" | "light" | "auth";
type RecordMotion = { el: HTMLElement; top: number; height: number; kind: string; start: number; end: number; visible: boolean };
type Engine = { setRoute(path: string): void; destroy(): void };
let engine: Engine | null = null;
const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
export function isScrollMotionAuthPath(path: string) {
  return ["/connexion", "/creation-compte", "/mot-de-passe-oublie", "/nouveau-mot-de-passe", "/verification-code"]
    .some((route) => path === route || path.startsWith(route + "/"));
}
export function getScrollMotionMode(path: string): ScrollMotionMode {
  if (isScrollMotionAuthPath(path)) return "auth";
  return path === "/" || path === "/client" || path.startsWith("/client/") ||
    path === "/resultats" || path.startsWith("/produit/") || path.startsWith("/offre/") ||
    path === "/panier" || path === "/suivi" || path === "/parapharmacie" || path === "/aide"
    ? "cinematic" : "light";
}
function createEngine(): Engine {
  const html = document.documentElement;
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const shortLandscapeQuery = matchMedia("(max-height: 499px)");
  const records = new Map<HTMLElement, RecordMotion>();
  let io: IntersectionObserver | null = null, mo: MutationObserver | null = null, ro: ResizeObserver | null = null;
  let route = "", mode: ScrollMotionMode = "light";
  let targetY = window.scrollY, shownY = targetY, previousY = targetY;
  let raf = 0, transitionFrames = 0, refresh = true, disposed = false;
  let reduced = reducedQuery.matches, lightweight = false;
  let width = window.innerWidth, height = window.innerHeight;
  const isLightweight = () => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return Boolean(connection?.saveData) ||
      (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2) ||
      shortLandscapeQuery.matches;
  };
  const schedule = () => { if (!disposed && !raf) raf = requestAnimationFrame(tick); };
  const setVisible = (el: HTMLElement, on: boolean) => {
    el.dataset.scrollMotionVisible = on ? "true" : "false";
    const record = records.get(el);
    if (record) record.visible = on;
    if (!on) el.style.setProperty("--scroll-blur", "0px");
  };
  const clearAutomatic = () => {
    document.querySelectorAll<HTMLElement>("[data-scroll-motion-auto='true']").forEach((el) => {
      delete el.dataset.scroll; delete el.dataset.scrollMotionAuto; delete el.dataset.scrollMotionVisible;
      el.style.removeProperty("--scroll-speed"); el.style.removeProperty("--scroll-from");
      el.style.removeProperty("--scroll-to"); el.style.removeProperty("--scroll-blur");
    });
    document.querySelectorAll<HTMLElement>("[data-scroll-motion-index-auto='true']").forEach((el) => {
      delete el.dataset.scrollIndex; delete el.dataset.scrollMotionIndexAuto; el.style.removeProperty("--i");
    });
  };
  const measure = () => {
    const mains = Array.from(document.querySelectorAll<HTMLElement>("main"));
    const allElements = new Set<HTMLElement>([
      ...Array.from(document.querySelectorAll<HTMLElement>("main, main *")),
      ...Array.from(document.querySelectorAll<HTMLElement>("[data-scroll], [data-scene]")),
    ]);
    // Batch all geometry reads before changing any attributes or styles.
    const rects = new Map<HTMLElement, { top: number; height: number; width: number }>();
    allElements.forEach((el) => {
      const r = el.getBoundingClientRect();
      rects.set(el, { top: r.top + window.scrollY, height: r.height, width: r.width });
    });
    mains.forEach((main) => {
      main.dataset.naxaScrollMode = mode;
      if (mode === "auth") return;
      main.querySelectorAll<HTMLElement>("section, article, h1, h2, h3, h4, main > ul, main > ol, main li, .carte, .naxa-product-card, [data-scroll-stagger] > *, img").forEach((el) => {
        if (el.hasAttribute("data-scene") || el.closest("[data-scene]")) return;
        if (el.closest("form, button, input, select, textarea, nav, [role='dialog'], [data-scroll-motion-ignore], .auth-content, .auth-stage")) return;
        if (el.dataset.scroll) return;
        const r = rects.get(el);
        if (!r) return;
        if (el.tagName === "IMG") {
          if (r.width < 96 || r.height < 96) return;
          el.dataset.scroll = "parallax"; el.dataset.speed = el.dataset.speed || "0.55";
        } else el.dataset.scroll = "rise";
        el.dataset.scrollMotionAuto = "true";
      });
      main.querySelectorAll<HTMLElement>("[data-scroll-stagger]").forEach((group) => {
        Array.from(group.children).forEach((child, index) => {
          if (!(child instanceof HTMLElement)) return;
          if (!child.dataset.scroll) { child.dataset.scroll = "stagger"; child.dataset.scrollMotionAuto = "true"; }
          if (!child.hasAttribute("data-scroll-index")) {
            child.dataset.scrollIndex = String(index); child.dataset.scrollMotionIndexAuto = "true";
            child.style.setProperty("--i", String(index));
          }
        });
      });
    });
    const motion = new Set<HTMLElement>([
      ...Array.from(document.querySelectorAll<HTMLElement>("[data-scroll]")),
      ...Array.from(document.querySelectorAll<HTMLElement>("[data-scene]")),
    ]);
    records.forEach((_, el) => { if (!el.isConnected || !motion.has(el)) { io?.unobserve(el); records.delete(el); } });
    motion.forEach((el) => {
      const r = rects.get(el);
      if (!r) return;
      const kind = el.hasAttribute("data-scene") ? "scene" : (el.dataset.scroll || "rise");
      const startValue = Number.parseFloat(el.dataset.start || "0");
      const endValue = Number.parseFloat(el.dataset.end || "1");
      const existing = records.get(el);
      records.set(el, {
        el, top: r.top, height: r.height, kind,
        start: Number.isFinite(startValue) ? startValue : 0,
        end: Number.isFinite(endValue) && endValue !== startValue ? endValue : 1,
        visible: existing?.visible ?? !io,
      });
      const speed = Number.parseFloat(el.dataset.speed || "1");
      el.style.setProperty("--scroll-speed", String(Math.min(2, Math.max(0, Number.isFinite(speed) ? speed : 1)) * 18) + "px");
      el.style.setProperty("--scroll-from", el.dataset.from || (kind === "parallax" ? "14px" : "18px"));
      el.style.setProperty("--scroll-to", el.dataset.to || "0px");
      if (!existing) io?.observe(el);
    });
    document.querySelectorAll<HTMLElement>("header").forEach((el) => {
      if (!el.hasAttribute("data-scroll-motion-ignore")) el.dataset.scrollHeader = "true";
    });
    refresh = false;
  };
  function tick() {
    raf = 0;
    if (disposed) return;
    if (refresh) measure();
    const factor = matchMedia("(pointer: coarse)").matches ? 0.12 : 0.08;
    const delta = targetY - shownY;
    shownY += delta * factor;
    if (Math.abs(delta) < 0.18) shownY = targetY;
    const velocity = Math.abs(shownY - previousY);
    previousY = shownY;
    const vh = window.innerHeight;
    records.forEach((r) => {
      if (!r.visible && r.kind !== "scene") return;
      if (reduced) { r.el.style.setProperty("--p", "1"); r.el.style.setProperty("--scroll-blur", "0px"); return; }
      const raw = r.kind === "scene"
        ? clamp((shownY - r.top) / Math.max(1, r.height - vh))
        : clamp((vh - (r.top - shownY)) / Math.max(1, vh * 0.64));
      const p = clamp((raw - r.start) / (r.end - r.start));
      r.el.style.setProperty("--p", p.toFixed(4));
      r.el.style.setProperty("--scroll-blur", (lightweight ? 0 : Math.min(6, velocity * 0.035)).toFixed(2) + "px");
    });
    html.toggleAttribute("data-naxa-header-compact", shownY > 36);
    html.toggleAttribute("data-naxa-scroll-lightweight", lightweight);
    if (transitionFrames > 0 && --transitionFrames === 0) {
      document.querySelectorAll<HTMLElement>("main[data-scroll-route-enter]").forEach((el) => delete el.dataset.scrollRouteEnter);
    }
    if (Math.abs(targetY - shownY) >= 0.18 || transitionFrames > 0) schedule();
  }
  const onScroll = () => { targetY = window.scrollY; schedule(); };
  const onResize = () => {
    const nextW = window.innerWidth, nextH = window.innerHeight;
    if (nextW === width && Math.abs(nextH - height) < 120) return;
    width = nextW; height = nextH; lightweight = isLightweight(); refresh = true; schedule();
  };
  const onReduced = () => {
    reduced = reducedQuery.matches; html.toggleAttribute("data-naxa-scroll-reduced", reduced);
    if (reduced) records.forEach((r) => { r.el.style.setProperty("--p", "1"); r.el.style.setProperty("--scroll-blur", "0px"); });
    else refresh = true;
    schedule();
  };
  const onShortLandscape = () => { lightweight = isLightweight(); refresh = true; schedule(); };
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.target instanceof HTMLElement) setVisible(entry.target, entry.isIntersecting); });
      schedule();
    }, { rootMargin: "180px 0px", threshold: 0 });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  reducedQuery.addEventListener("change", onReduced);
  shortLandscapeQuery.addEventListener("change", onShortLandscape);
  if ("MutationObserver" in window) {
    mo = new MutationObserver(() => { refresh = true; schedule(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if ("ResizeObserver" in window) {
    ro = new ResizeObserver(() => { refresh = true; schedule(); });
    document.querySelectorAll<HTMLElement>("main").forEach((el) => ro?.observe(el));
  }
  const setRoute = (path: string) => {
    if (route === path) { refresh = true; schedule(); return; }
    route = path || "/"; mode = getScrollMotionMode(route); clearAutomatic();
    html.dataset.naxaScrollMode = mode; html.classList.add("naxa-scroll-motion-enabled");
    lightweight = isLightweight(); html.toggleAttribute("data-naxa-scroll-lightweight", lightweight);
    html.toggleAttribute("data-naxa-scroll-reduced", reduced);
    targetY = window.scrollY; shownY = targetY; transitionFrames = 15;
    document.querySelectorAll<HTMLElement>("main").forEach((el) => { el.dataset.scrollRouteEnter = "true"; });
    ro?.disconnect(); document.querySelectorAll<HTMLElement>("main").forEach((el) => ro?.observe(el));
    refresh = true; schedule();
  };
  const destroy = () => {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize);
    reducedQuery.removeEventListener("change", onReduced); shortLandscapeQuery.removeEventListener("change", onShortLandscape);
    io?.disconnect(); mo?.disconnect(); ro?.disconnect(); clearAutomatic(); records.clear();
    html.classList.remove("naxa-scroll-motion-enabled");
    delete html.dataset.naxaScrollMode; delete html.dataset.naxaHeaderCompact;
    delete html.dataset.naxaScrollLightweight; delete html.dataset.naxaScrollReduced;
  };
  return { setRoute, destroy };
}
export function mountScrollMotion() {
  if (engine) return () => undefined;
  engine = createEngine();
  return () => { engine?.destroy(); engine = null; };
}
export function setScrollMotionRoute(path: string) { engine?.setRoute(path); }
