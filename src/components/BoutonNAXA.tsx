"use client";

import { useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  importance?: "ordinaire" | "importante";
  loading?: boolean;
  success?: boolean;
  children: ReactNode;
};

export function BoutonNAXA({
  importance = "ordinaire",
  loading = false,
  success = false,
  disabled,
  className = "",
  children,
  onClick,
  ...props
}: Props) {
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const nextId = useRef(0);

  function click(event: MouseEvent<HTMLButtonElement>) {
    if (disabled || loading) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setRipple({ x: event.clientX ? event.clientX - rect.left : rect.width / 2, y: event.clientY ? event.clientY - rect.top : rect.height / 2, id: ++nextId.current });
    onClick?.(event);
  }

  return (
    <button {...props} disabled={disabled || loading} onClick={click} aria-busy={loading || undefined} data-importance={importance} className={`btn relative isolate overflow-hidden ${className}`}>
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {loading ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : success ? <span aria-hidden="true" className="naxa-success-check">✓</span> : null}
        {children}
      </span>
      {ripple && <span key={ripple.id} aria-hidden="true" className="naxa-button-ripple" style={{ left: ripple.x, top: ripple.y }} />}
    </button>
  );
}
