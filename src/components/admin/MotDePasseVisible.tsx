"use client";

import { useState } from "react";

export function MotDePasseVisible({ className = "champ mt-1", error }: { className?: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="relative mt-1">
    <input name="motdepasse" type={visible ? "text" : "password"} autoComplete="new-password" minLength={6} required aria-invalid={!!error} className={className + " pr-12 " + (error ? "border-red-600" : "")}/>
    <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={visible} className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
      {visible ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 9 5.4 9 7a8.8 8.8 0 0 1-2.2 3.4M6.2 6.2C4.2 7.6 3 10 3 12c0 1.4 3.8 7 9 7 1.2 0 2.3-.3 3.3-.8"/></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12s3.4-7 9.5-7 9.5 7 9.5 7-3.4 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>}
    </button>
  </div>;
}
