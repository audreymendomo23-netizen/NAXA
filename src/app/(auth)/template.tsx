"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthFlow } from "@/components/auth/AuthFlowContext";

export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { direction } = useAuthFlow();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let attempts = 0;
    let frame = 0;
    const announceAndFocus = () => {
      const title = contentRef.current?.querySelector<HTMLElement>("h1");
      const target = title ?? contentRef.current?.querySelector<HTMLElement>("input:not([type=hidden])");
      if (title?.textContent?.trim()) setAnnouncement(title.textContent.trim());
      if (target) {
        if (title && !title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        return;
      }
      if (attempts++ < 8) frame = window.requestAnimationFrame(announceAndFocus);
    };
    frame = window.requestAnimationFrame(announceAndFocus);
    const observer = new MutationObserver(() => {
      const title = contentRef.current?.querySelector<HTMLElement>("h1");
      if (title?.textContent?.trim()) setAnnouncement(title.textContent.trim());
    });
    if (contentRef.current) observer.observe(contentRef.current, { subtree: true, childList: true, characterData: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname]);

  return <div ref={contentRef} className={`auth-stage auth-stage-${direction}`}>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    {children}
  </div>;
}
