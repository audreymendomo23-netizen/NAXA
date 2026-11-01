"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/pharmacie/comptable", label: "Tableau de bord" },
  { href: "/pharmacie/comptable/journal-ventes", label: "Journal des ventes" },
  { href: "/pharmacie/comptable/rapprochements", label: "Trésorerie & rapprochements" },
  { href: "/pharmacie/comptable/clotures", label: "Clôtures comptables" },
  { href: "/pharmacie/comptable/journal-audit", label: "Journal d’audit" },
  { href: "/pharmacie/comptable/service", label: "Prise / fin de service" },
  { href: "/pharmacie/comptable/profil", label: "Profil & déconnexion" },
];

export function ComptableSidebar() {
  const pathname = usePathname();
  return <aside className="h-fit rounded-2xl bg-[#0B3D26] p-3 text-white lg:sticky lg:top-4">
    <div className="px-3 py-4"><p className="text-lg font-black">NAXA</p><p className="text-xs text-emerald-100">Compte Comptable</p></div>
    <nav aria-label="Navigation Comptable" className="space-y-1">
      {items.map(item => {
        const active = pathname === item.href || (item.href !== "/pharmacie/comptable" && pathname.startsWith(item.href + "/"));
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
          className={`flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-[#FFE23D] text-[#0B3D26]" : "text-white hover:bg-white/10"}`}>
          {item.label}
        </Link>;
      })}
    </nav>
  </aside>;
}
