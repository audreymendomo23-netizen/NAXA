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
      document.querySelectorAll<HTMLElement>('[role="alert"], [aria-live="assertive"]').forEach((element) => {
        if (element.dataset.naxaToast !== undefined || element.closest("[data-naxa-toast]")) return;
        const message = (element.innerText || element.textContent || "").trim();
        if (!message || seen.get(element) === message) return;
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
    }, active.message.length * 28 + 7200);
    return () => window.clearTimeout(timer);
  }, [active]);
  return active ? <BulleErreur key={active.id} message={active.message} /> : null;
}
