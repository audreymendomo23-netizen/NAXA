"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/admin", label: "Vue générale", note: "Accueil" },
  { href: "/admin/promoteurs", label: "Dossiers Promoteurs", note: "Validation pharmacies" },
  { href: "/admin/pilotage", label: "Pilotage réseau", note: "Indicateurs" },
  { href: "/admin/pilotage/validite", label: "Validité", note: "Conventions" },
  { href: "/admin/pilotage/rapports", label: "Rapports", note: "Exports" },
  { href: "/admin/produits", label: "Produits", note: "Fiches santé" },
  { href: "/admin/univers", label: "Univers & partenaires", note: "Catalogue" },
  { href: "/admin/prestations", label: "Prestations", note: "À domicile" },
  { href: "/admin/examens", label: "Examens", note: "Centres & packs" },
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
