"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/admin", label: "Tableau de bord", note: "Indicateurs et activité" },
  { href: "/admin/alertes", label: "Alertes réseau", note: "Stock et validité" },
  { href: "/admin/journal", label: "Journal d’administration", note: "Événements tous univers" },
  { href: "/admin/promoteurs", label: "Dossiers Promoteurs", note: "Tous les univers" },
  { href: "/admin/pilotage", label: "Pilotage réseau", note: "Indicateurs" },
  { href: "/admin/pilotage/validite", label: "Validité", note: "Conventions" },
  { href: "/admin/pilotage/rapports", label: "Rapports", note: "Exports" },
  { href: "/admin/produits", label: "Produits", note: "Fiches santé" },
  { href: "/admin/univers", label: "Univers & catalogue", note: "Partenaires, prestations, examens" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav className="admin-bento-nav" aria-label="Pages d’administration">
      {sections.map((section, index) => {
        const active = pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={`admin-bento-nav-link${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="admin-bento-nav-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span className="admin-bento-nav-copy"><strong>{section.label}</strong><small>{section.note}</small></span>
            <span className="admin-bento-nav-arrow" aria-hidden="true">↗</span>
          </Link>
        );
      })}
    </nav>
  );
}
