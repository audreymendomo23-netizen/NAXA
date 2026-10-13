"use client";
import { useEffect, useRef, useState } from "react";
import { BulleErreur } from "@/components/BulleErreur";
type Message = { id: number; message: string };
export function notifierNAXA(message: string) {
  if (typeof window === "undefined" || !message.trim()) return;
  window.dispatchEvent(new CustomEvent("naxa:notification", { detail: message.trim() }));
}
export function NotificationGlobale() {
  const [active, setActive] = useState<Message | null>(null);
  const activeRef = useRef(false);
  const queue = useRef<Message[]>([]);
  const nextId = useRef(0);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const message = typeof detail === "string" ? detail.trim() :
        detail && typeof detail === "object" && "message" in detail
          ? String((detail as { message?: unknown }).message ?? "").trim() : "";
      if (!message) return;
      const item = { id: ++nextId.current, message };
      if (activeRef.current) queue.current.push(item);
      else { activeRef.current = true; setActive(item); }
    };
    window.addEventListener("naxa:notification", receive);
    return () => window.removeEventListener("naxa:notification", receive);
  }, []);
  useEffect(() => {
    const seen = new WeakMap<HTMLElement, string>();
    const scan = () => {
      const selector = '[role="alert"], [aria-live="assertive"], p.text-red-700, p.text-red-600, p.text-red-500, span.text-red-700, span.text-red-600, span.text-red-500, div.text-red-700, div.text-red-600, div.text-red-500';
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (element.dataset.naxaToast !== undefined || element.closest("[data-naxa-toast]")) return;
        if (element.closest("button, a, label") || element.querySelector(selector)) return;
        const message = (element.innerText || element.textContent || "").trim();
        if (!message || message.length > 400 || seen.get(element) === message) return;
        seen.set(element, message);
        element.classList.add("sr-only");
        notifierNAXA(message);
      });
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    scan();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      const next = queue.current.shift() ?? null;
      activeRef.current = Boolean(next);
      setActive(next);
    }, active.message.length * 28 + 2500);
    return () => window.clearTimeout(timer);
  }, [active]);
  return active ? <BulleErreur key={active.id} message={active.message} /> : null;
}
