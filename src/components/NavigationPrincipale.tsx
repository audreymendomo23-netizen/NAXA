"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Home, Menu, ScanLine, Search } from "lucide-react";

export function NavigationPrincipale() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const achatsActifs = pathname === "/client" && searchParams.get("onglet") === "achats";
  const favorisActifs = pathname === "/client/profil/favoris";
  const profilActif = (pathname === "/client" && !achatsActifs) ||
    (pathname.startsWith("/client/profil/") && !favorisActifs) ||
    pathname.startsWith("/reservation/");
  const visible = pathname === "/" || pathname === "/recherche" || pathname === "/scanner" ||
    pathname === "/resultats" || pathname === "/panier" || pathname === "/gardes" ||
    pathname === "/client" || pathname.startsWith("/client/profil/") ||
    pathname.startsWith("/produit/") || pathname.startsWith("/offre/") || pathname.startsWith("/reservation/");
  if (!visible) return null;

  const items = [
    { label: "Accueil", href: "/", active: pathname === "/", icon: Home },
    { label: "Recherche", href: "/recherche", active: pathname === "/recherche" || pathname === "/resultats" || pathname === "/panier" || pathname === "/gardes" || pathname.startsWith("/produit/") || pathname.startsWith("/offre/"), icon: Search },
    { label: "Scanner", href: "/scanner", active: pathname === "/scanner", icon: ScanLine },
    { label: "Favoris", href: "/client/profil/favoris", active: favorisActifs, icon: CheckCircle2 },
    { label: "Profil", href: "/client", active: profilActif, icon: Menu },
  ];

  return <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 rounded-t-[24px] border-t border-[#E5ECE7] bg-white px-2 pt-2 shadow-[0_-8px_24px_rgba(11,61,38,0.10)]" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}>
    <div className="mx-auto grid max-w-[480px] grid-cols-5 items-end gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const scanner = item.label === "Scanner";
        return <Link key={item.label} href={item.href} aria-current={item.active ? "page" : undefined} aria-label={item.label}
          className={`relative flex min-h-[62px] flex-col items-center justify-end gap-1 rounded-2xl px-0.5 pb-1.5 text-[11px] leading-none transition-colors ${scanner ? "pt-0" : "pt-1"}`}>
          {item.active && !scanner && <motion.span layoutId="naxa-nav-active" transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 34 }} className="absolute inset-x-0 top-0 bottom-0 rounded-2xl bg-[#0F6B3F]" />}
          <span className={`relative z-10 flex items-center justify-center ${scanner ? "-mt-5 h-14 w-14 rounded-full bg-[#FFE23D] text-[#0B3D26] shadow-[0_5px_14px_rgba(255,226,61,0.35)]" : "h-6 w-8"} ${item.active && !scanner ? "text-white" : scanner ? "text-[#0B3D26]" : item.active ? "text-[#0F6B3F]" : "text-[#87948C]"} ${scanner ? "naxa-scanner-breathe" : ""}`}>
            <Icon size={scanner ? 26 : 21} strokeWidth={2} aria-hidden="true"/>
          </span>
          <span className={`relative z-10 font-semibold ${item.active && !scanner ? "text-white" : scanner ? "text-[#0B3D26]" : item.active ? "text-[#0F6B3F]" : "text-[#87948C]"}`}>{item.label}</span>
          {item.active && !scanner && <span className="relative z-10 mt-0.5 h-0.5 w-5 rounded-full bg-[#FFE23D]" />}
        </Link>;
      })}
    </div>
  </nav>;
}
