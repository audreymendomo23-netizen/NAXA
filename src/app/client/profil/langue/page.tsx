"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Language = "fr" | "en";
const LANGUAGE_KEY = "naxa-langue";

function FranceFlag() {
  return <svg viewBox="0 0 36 24" className="h-6 w-9 overflow-hidden rounded-[3px] shadow-sm" role="img" aria-label="Français"><rect width="12" height="24" fill="#1D3F8B"/><rect x="12" width="12" height="24" fill="#fff"/><rect x="24" width="12" height="24" fill="#E43D43"/></svg>;
}
function UkFlag() {
  return <svg viewBox="0 0 36 24" className="h-6 w-9 overflow-hidden rounded-[3px] shadow-sm" role="img" aria-label="English"><rect width="36" height="24" fill="#21468B"/><path d="M0 0 36 24M36 0 0 24" stroke="#fff" strokeWidth="5"/><path d="M0 0 36 24M36 0 0 24" stroke="#C8102E" strokeWidth="2"/><path d="M18 0v24M0 12h36" stroke="#fff" strokeWidth="8"/><path d="M18 0v24M0 12h36" stroke="#C8102E" strokeWidth="4"/></svg>;
}
function Check() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>;
}

export default function LangueClientPage() {
  const [language, setLanguage] = useState<Language>("fr");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const syncLanguage = () => {
      let saved: string | null = null;
      try { saved = window.localStorage.getItem(LANGUAGE_KEY); } catch { /* La langue par défaut reste disponible. */ }
      const next: Language = saved === "en" ? "en" : "fr";
      setLanguage(next);
      document.documentElement.lang = next;
    };
    syncLanguage();
    window.addEventListener("naxa-language-updated", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("naxa-language-updated", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  const chooseLanguage = useCallback((next: Language) => {
    setLanguage(next);
    try { window.localStorage.setItem(LANGUAGE_KEY, next); } catch { /* La préférence reste active pendant cette visite. */ }
    document.documentElement.lang = next;
    window.dispatchEvent(new CustomEvent("naxa-language-updated", { detail: { language: next } }));
    setToast(next === "fr" ? "Langue définie sur Français." : "Language set to English.");
    window.setTimeout(() => { window.location.href = "/client/profil"; }, 550);
  }, []);

  const isEnglish = language === "en";
  return <main className="min-h-dvh bg-black/35 px-0 text-[#111111]">
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-end">
      <section role="dialog" aria-modal="true" aria-labelledby="language-title" className="naxa-profile-sheet w-full rounded-t-[24px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl">
        <Link href="/client/profil" aria-label={isEnglish ? "Back to profile" : "Retour au profil"} className="mb-2 flex h-8 w-full items-center justify-center"><span className="h-1.5 w-10 rounded-full bg-[#D1D5DB]"/></Link>
        <h1 id="language-title" className="mb-4 text-xl font-extrabold text-[#0F4D26]">{isEnglish ? "Language" : "Langue"}</h1>
        <div className="space-y-2">
          <button type="button" onClick={() => chooseLanguage("fr")} aria-pressed={language === "fr"} className={`flex min-h-[68px] w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[.99] ${language === "fr" ? "border-[#1E7B3A] bg-[#E9F5EC]/70" : "border-[#E5E7EB] bg-white"}`}>
            <FranceFlag/><span className="flex-1 font-bold text-[#111111]">Français</span>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${language === "fr" ? "animate-[naxa-verified-in_240ms_ease-out] border-[#1E7B3A] bg-[#1E7B3A] text-white" : "border-[#D1D5DB] text-transparent"}`}><Check/></span>
          </button>
          <button type="button" onClick={() => chooseLanguage("en")} aria-pressed={language === "en"} className={`flex min-h-[68px] w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[.99] ${language === "en" ? "border-[#1E7B3A] bg-[#E9F5EC]/70" : "border-[#E5E7EB] bg-white"}`}>
            <UkFlag/><span className="flex-1 font-bold text-[#111111]">English</span>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${language === "en" ? "animate-[naxa-verified-in_240ms_ease-out] border-[#1E7B3A] bg-[#1E7B3A] text-white" : "border-[#D1D5DB] text-transparent"}`}><Check/></span>
          </button>
        </div>
        <Link href="/client/profil" className="mt-3 flex min-h-11 items-center justify-center font-semibold text-[#6B7280]">{isEnglish ? "Cancel" : "Annuler"}</Link>
      </section>
    </div>
    {toast && <div role="status" aria-live="polite" className="naxa-profile-toast fixed left-1/2 top-4 z-[150] -translate-x-1/2 rounded-full bg-[#0F4D26] px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
  </main>;
}
