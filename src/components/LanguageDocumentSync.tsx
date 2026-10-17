"use client";

import { useEffect } from "react";

const LANGUAGE_KEY = "naxa-langue";

export function LanguageDocumentSync() {
  useEffect(() => {
    const syncLanguage = () => {
      try {
        const saved = window.localStorage.getItem(LANGUAGE_KEY);
        document.documentElement.lang = saved === "en" ? "en" : "fr";
      } catch {
        document.documentElement.lang = "fr";
      }
    };
    syncLanguage();
    window.addEventListener("naxa-language-updated", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("naxa-language-updated", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  return null;
}
