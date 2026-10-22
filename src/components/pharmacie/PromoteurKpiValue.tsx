"use client";
import { useEffect, useState } from "react";

type Props = { value: string; className?: string };

export function PromoteurKpiValue({ value, className }: Props) {
  const integer = /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
  const target = integer ? Number(value) : null;
  const [display, setDisplay] = useState(integer ? "0" : value);

  useEffect(() => {
    if (target === null) {
      setDisplay(value);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 520;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(String(Math.round(target * eased)));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, value]);

  return <p className={className}>{display}</p>;
}
