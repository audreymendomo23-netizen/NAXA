"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type NavPromoteurEntry = { label: string; href: string; icon: string };
type Props = { entries: NavPromoteurEntry[]; logoutAction: () => Promise<void> };

const iconPaths: Record<string, string> = {
  "▦": "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  "⌘": "M9 3H6a3 3 0 0 0 0 6h3v6H6a3 3 0 0 0 0 6h3 M15 3h3a3 3 0 0 1 0 6h-3v6h3a3 3 0 0 1 0 6h-3 M9 12h6",
  "↗": "M7 17 17 7 M8 7h9v9", "◇": "m12 3 9 9-9 9-9-9 9-9z",
  "▤": "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",
  "♙": "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
  "▧": "M4 4h16v16H4z M8 8h8v8H8z", "▥": "M4 19V5 M10 19V9 M16 19V3 M22 19H2",
  "⚙": "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19 12h2 M3 12h2 M12 3v2 M12 19v2 M18.4 5.6 17 7 M7 17l-1.4 1.4 M18.4 18.4 17 17 M7 7 5.6 5.6",
  "↪": "M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-2",
};
function NavIcon({ symbol }: { symbol: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[symbol] ?? "M12 3v18 M3 12h18"} /></svg>;
}

export function NavPromoteur({ entries, logoutAction }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState("#accueil");
  const primary = entries.slice(0, 9);
  const secondary = entries.slice(9);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const nodes = entries.filter((entry) => entry.href.startsWith("#"))
      .map((entry) => document.getElementById(entry.href.slice(1)))
      .filter((node): node is HTMLElement => node !== null);
    if (!nodes.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((items) => {
      const visible = items.filter((item) => item.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveAnchor(`#${visible.target.id}`);
    }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.1, 0.35, 0.6] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [entries]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const isActive = (entry: NavPromoteurEntry) => entry.href.startsWith("#")
    ? activeAnchor === entry.href
    : entry.href !== "/pharmacie?vue=operation" && pathname === entry.href.split("?")[0];

  const renderEntry = (entry: NavPromoteurEntry) => {
    const label = entry.label.replace(/^\d+\.\s*/, "");
    const active = isActive(entry);
    return <Link key={entry.label} href={entry.href} onClick={close} aria-label={label}
      aria-current={active ? "page" : undefined} title={label}
      className={`group relative flex min-h-11 items-center gap-3 rounded-2xl px-1.5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naxa-canari lg:px-3 ${active ? "bg-naxa-green-900 text-white" : "text-naxa-green-900 hover:bg-naxa-green-50"}`}>
      {active && <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-naxa-canari" />}
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${active ? "text-naxa-canari" : "text-naxa-green-700"}`}><NavIcon symbol={entry.icon} /></span>
      <span className="nav-promoteur-label min-w-0 flex-1">{label}</span>
    </Link>;
  };

  return <>
    {open && <button type="button" aria-label="Fermer le menu de navigation" className="fixed inset-0 z-[70] bg-naxa-green-900/50 backdrop-blur-[2px] lg:hidden" onClick={close} />}
    <aside aria-label="Navigation Promoteur" className={`nav-promoteur fixed inset-y-0 left-0 z-[80] flex flex-col border-r border-naxa-green-100 bg-white transition-[width,transform] duration-200 ease-out ${open ? "nav-promoteur-open w-[264px] translate-x-0 shadow-2xl" : "w-14 translate-x-0 lg:w-60"}`}>
      <div className="flex h-[72px] shrink-0 items-center gap-2 border-b border-naxa-green-100 px-2 lg:gap-3 lg:px-3">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Réduire la navigation" : "Ouvrir le menu de navigation"} aria-expanded={open} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-naxa-green-900 hover:bg-naxa-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-naxa-canari lg:hidden">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={open ? "m6 6 12 12M18 6 6 18" : "M4 6h16M4 12h16M4 18h16"} /></svg>
        </button>
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-naxa-green-900 text-xl font-black text-naxa-canari">N</span>
        <div className="nav-promoteur-label min-w-0"><p className="text-sm font-extrabold text-naxa-green-900">Espace Promoteur</p><p className="text-xs font-semibold text-naxa-green-700">Réseau · Niveau N1</p></div>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-4" aria-label="Sections Promoteur">
        {primary.map(renderEntry)}
        <div className="mx-2 my-3 border-t border-naxa-green-100" />
        {secondary.map(renderEntry)}
        <form action={logoutAction} className="pt-1">
          <button type="submit" aria-label="Déconnexion" title="Déconnexion" className="group relative flex min-h-11 w-full items-center gap-3 rounded-2xl px-1.5 py-2.5 text-left text-sm font-semibold text-red-800 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-naxa-canari lg:px-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center"><NavIcon symbol="↪" /></span><span className="nav-promoteur-label">Déconnexion</span>
          </button>
        </form>
      </nav>
      <p className="nav-promoteur-label shrink-0 border-t border-naxa-green-100 px-4 py-4 text-xs leading-5 text-naxa-green-700">Les données visibles restent limitées au réseau autorisé. Les modules non dédiés réutilisent les écrans existants sans contourner les droits serveur.</p>
    </aside>
  </>;
}
