"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "article" | "li";
};

export function Reveal({ children, className = "", delay = 0, as = "div" }: RevealProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const Tag = as;
  return (
    <Tag
      ref={elementRef as never}
      className={`naxa-reveal ${className}`.trim()}
      data-visible={visible ? "true" : "false"}
      style={{ "--reveal-delay": `${Math.max(0, Math.min(delay, 600))}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
