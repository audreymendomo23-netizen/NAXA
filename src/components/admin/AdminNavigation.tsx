"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/admin", label: "Tableau de bord", note: "Indicateurs et activité" },
  { href: "/admin/alertes", label: "Alertes réseau", note: "Stock et validité" },
  { href: "/admin/journal", label: "Journal d’administration", note: "Événements tous univers" },
  { href: "/admin/messagerie", label: "Messagerie", note: "Requêtes et réponses" },
  { href: "/admin/promoteurs", label: "Dossiers Promoteurs", note: "Tous les univers" },
  { href: "/admin/pilotage", label: "Pilotage réseau", note: "Indicateurs décisionnels" },
  { href: "/admin/pilotage/validite", label: "Validité", note: "Conventions et échéances" },
  { href: "/admin/pilotage/reglements", label: "Paiements & réabonnements", note: "Vérifier, confirmer ou contester" },
  { href: "/admin/pilotage/reglements/configuration", label: "Coordonnées de paiement", note: "Codes marchands et instructions" },
  { href: "/admin/pilotage/reservations", label: "Réservations Marketplace", note: "Suivi des réservations" },
  { href: "/admin/pilotage/rapports", label: "Rapports", note: "Exports et analyses" },
  { href: "/admin/livraisons", label: "Livraisons & commissions", note: "Tarifs, zones et commissions" },
  { href: "/admin/gardes", label: "Pharmacies de garde", note: "Planning et publications" },
  { href: "/admin/geolocalisation", label: "Géolocalisation", note: "Coordonnées des pharmacies" },
  { href: "/admin/rappels-lots", label: "Rappels de lots", note: "Avis officiels au réseau" },
  { href: "/admin/suivi-professionnels", label: "Accréditations santé", note: "Vérifier les justificatifs" },
  { href: "/admin/prestations", label: "Prestations à domicile", note: "Offres et partenaires" },
  { href: "/admin/prestations/demandes", label: "Demandes de prestations", note: "Demandes clients" },
  { href: "/admin/prestations/conventions", label: "Conventions indépendantes", note: "Accords et approbations" },
  { href: "/admin/examens", label: "Centres et examens", note: "Publication, suivi et tickets" },
  { href: "/admin/univers", label: "Univers & catalogue", note: "Partenaires et prestations" },
  { href: "/admin/produits", label: "Fiches produits", note: "Relecture des fiches santé" },
  { href: "/admin/configuration", label: "Configuration", note: "Langue et apparence" },
  { href: "/admin/profil", label: "Profil", note: "Données du compte" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav className="admin-bento-nav" aria-label="Pages d’administration">
      {sections.map((section, index) => {
        const activeHref = sections
          .filter((candidate) => pathname === candidate.href || pathname.startsWith(candidate.href + "/"))
          .sort((a, b) => b.href.length - a.href.length)[0]?.href;
        const active = activeHref === section.href;
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
