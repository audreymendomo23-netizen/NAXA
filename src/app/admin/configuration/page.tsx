"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const THEME_KEY = "naxa-theme-night-v1";
const LANGUAGE_KEY = "naxa-langue";

export default function ConfigurationAdmin() {
  const [night, setNight] = useState(false);
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setNight(localStorage.getItem(THEME_KEY) === "night");
      setLanguage(localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "fr");
    } finally {
      setReady(true);
    }
  }, []);

  function changeNight(enabled: boolean) {
    setNight(enabled);
    try {
      localStorage.setItem(THEME_KEY, enabled ? "night" : "day");
      const root = document.documentElement;
      root.setAttribute("data-theme", enabled ? "nuit" : "jour");
      root.classList.toggle("naxa-dark", enabled);
      root.style.colorScheme = enabled ? "dark" : "light";
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", enabled ? "#0B1210" : "#064B2A");
    } catch {}
  }

  function changeLanguage(value: "fr" | "en") {
    setLanguage(value);
    try {
      localStorage.setItem(LANGUAGE_KEY, value);
      document.documentElement.lang = value;
      window.dispatchEvent(new Event("naxa-language-updated"));
    } catch {}
  }

  return <main className="space-y-5">
    <header><div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Préférences</p><h1>Configuration</h1><p className="mt-2 text-sm text-slate-600">Préférences enregistrées sur cet appareil pour votre session NAXA.</p></div><Link href="/admin" className="rounded-full border px-4 py-2 text-sm font-bold">Retour au tableau de bord</Link></header>
    <section className="grid gap-4 md:grid-cols-2">
      <article className="carte space-y-3"><h2 className="text-lg font-extrabold">Langue</h2><label className="block text-sm font-semibold">Langue de l’interface
        <select value={language} disabled={!ready} onChange={(event) => changeLanguage(event.target.value as "fr" | "en")} className="champ mt-2"><option value="fr">Français</option><option value="en">English (préférence du document)</option></select>
      </label><p className="text-xs text-slate-500">La préférence de langue et l’attribut de document sont synchronisés. Les écrans qui n’ont pas encore de traduction restent dans leur langue d’origine.</p></article>
      <article className="carte space-y-3"><h2 className="text-lg font-extrabold">Apparence</h2><label className="flex items-center justify-between gap-4"><span><strong className="block">Mode nuit</strong><small className="text-slate-500">Appliquer le thème sombre NAXA sur les composants compatibles.</small></span><input type="checkbox" checked={night} disabled={!ready} onChange={(event) => changeNight(event.target.checked)} className="h-5 w-5 accent-emerald-800"/></label><p className="text-xs text-slate-500">Le choix est conservé localement et réappliqué au prochain chargement.</p></article>
    </section>
  </main>;
}
