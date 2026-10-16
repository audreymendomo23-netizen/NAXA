"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "home" | "search" | "scan" | "heart" | "user";

function Icon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  return <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
    {name === "home" && <><path d="m3 10 9-7 9 7" /><path d="M5.5 9v11h13V9M9 20v-6h6v6" /></>}
    {name === "search" && <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>}
    {name === "scan" && <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" /></>}
    {name === "heart" && <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /> }
    {name === "user" && <><circle cx="12" cy="8" r="3.3" /><path d="M5 20c.5-3.4 2.9-5.2 7-5.2s6.5 1.8 7 5.2" /></>}
  </svg>;
}

export function NavigationPrincipale() {
  const pathname = usePathname();
  const favorisActifs = pathname === "/client/profil/favoris";
  const visible = pathname === "/" || pathname === "/recherche" || pathname === "/scanner" ||
    pathname === "/resultats" || pathname === "/panier" || pathname === "/gardes" ||
    pathname === "/client" || pathname.startsWith("/client/profil/") ||
    pathname.startsWith("/produit/") || pathname.startsWith("/offre/") || pathname.startsWith("/reservation/");
  if (!visible) return null;

  const items: { label: string; href: string; icon: IconName; active: boolean }[] = [
    { label: "Accueil", href: "/", icon: "home", active: pathname === "/" },
    { label: "Recherche", href: "/recherche", icon: "search", active: pathname === "/recherche" || pathname === "/resultats" || pathname === "/panier" || pathname === "/gardes" || pathname.startsWith("/produit/") || pathname.startsWith("/offre/") },
    { label: "Scanner", href: "/scanner", icon: "scan", active: pathname === "/scanner" },
    { label: "Favoris", href: "/client/profil/favoris", icon: "heart", active: favorisActifs },
    { label: "Profil", href: "/client", icon: "user", active: (pathname === "/client" || pathname.startsWith("/client/profil/")) && !favorisActifs || pathname.startsWith("/reservation/") },
  ];

  return <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/95 px-1.5 pt-2 shadow-[0_-5px_20px_rgba(6,75,42,0.08)] backdrop-blur-sm" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}>
    <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
      {items.map((item) => <Link key={item.label} href={item.href} aria-current={item.active ? "page" : undefined}
        className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] leading-none transition-colors ${item.active ? "bg-[#FFE33D] font-extrabold text-[#064B2A]" : "font-semibold text-[#6B8275] hover:bg-emerald-50"}`}>
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </Link>)}
    </div>
  </nav>;
}
