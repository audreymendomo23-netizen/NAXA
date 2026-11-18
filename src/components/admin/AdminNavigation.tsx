"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type AdminNavItem = { href: string; label: string; note: string };
type AdminNavGroup = { id: string; label: string; items: AdminNavItem[] };

const groups: AdminNavGroup[] = [
  {
    id: "accueil",
    label: "Accueil & supervision",
    items: [
      { href: "/admin", label: "Tableau de bord", note: "Indicateurs et activité" },
      { href: "/admin/alertes", label: "Alertes réseau", note: "Stock et validité" },
      { href: "/admin/journal", label: "Journal d’administration", note: "Événements tous univers" },
      { href: "/admin/messagerie", label: "Messagerie", note: "Requêtes et réponses" },
      { href: "/admin/support-agents", label: "Agents du service client", note: "Comptes, droits et disponibilité" },
    ],
  },
  {
    id: "reseau",
    label: "Réseau & professionnels",
    items: [
      { href: "/admin/promoteurs", label: "Dossiers Promoteurs", note: "Tous les univers" },
      { href: "/admin/gardes", label: "Pharmacies de garde", note: "Planning et publications" },
      { href: "/admin/geolocalisation", label: "Géolocalisation", note: "Coordonnées des pharmacies" },
      { href: "/admin/rappels-lots", label: "Rappels de lots", note: "Avis officiels au réseau" },
      { href: "/admin/suivi-professionnels", label: "Accréditations santé", note: "Vérifier les justificatifs" },
    ],
  },
  {
    id: "pilotage",
    label: "Pilotage & finances",
    items: [
      { href: "/admin/pilotage", label: "Pilotage réseau", note: "Indicateurs décisionnels" },
      { href: "/admin/pilotage/validite", label: "Validité", note: "Conventions et échéances" },
      { href: "/admin/pilotage/reglements", label: "Paiements & réabonnements", note: "Vérifier, confirmer ou contester" },
      { href: "/admin/abonnements-partenaires", label: "Abonnements partenaires", note: "Règlements par structure et échéances" },
      { href: "/admin/pilotage/reglements/configuration", label: "Coordonnées de paiement", note: "Codes marchands et instructions" },
      { href: "/admin/pilotage/reservations", label: "Réservations Marketplace", note: "Suivi des réservations" },
      { href: "/admin/pilotage/rapports", label: "Rapports", note: "Exports et analyses" },
    ],
  },
  {
    id: "operations",
    label: "Marketplace & opérations",
    items: [
      { href: "/admin/livraisons", label: "Livraisons & commissions", note: "Tarifs, zones et commissions" },
      { href: "/admin/prestations", label: "Prestations à domicile", note: "Offres et partenaires" },
      { href: "/admin/prestations/demandes", label: "Demandes de prestations", note: "Demandes clients" },
      { href: "/admin/prestations/conventions", label: "Conventions indépendantes", note: "Accords et approbations" },
      { href: "/admin/examens", label: "Centres et examens", note: "Publication, suivi et tickets" },
    ],
  },
  {
    id: "catalogue",
    label: "Catalogue",
    items: [
      { href: "/admin/univers", label: "Univers & catalogue", note: "Partenaires et prestations" },
      { href: "/admin/produits", label: "Fiches produits", note: "Relecture des fiches santé" },
    ],
  },
  {
    id: "compte",
    label: "Compte & configuration",
    items: [
      { href: "/admin/configuration", label: "Configuration", note: "Langue et apparence" },
      { href: "/admin/profil", label: "Profil", note: "Données du compte" },
    ],
  },
];

const allSections: AdminNavItem[] = groups.flatMap((group) => group.items);

function resolveActiveHref(pathname: string): string | undefined {
  // La fiche pharmacie est ouverte depuis le registre Promoteurs, mais sa route
  // n'est pas un sous-chemin de /admin/promoteurs.
  const navigationPath = /^\/admin\/pharmacies\/[^/]+\/?$/.test(pathname)
    ? "/admin/promoteurs"
    : pathname;

  return allSections
    .filter((section) => {
      if (section.href === "/admin") return navigationPath === "/admin";
      return navigationPath === section.href || navigationPath.startsWith(section.href + "/");
    })
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function AdminNavigation() {
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname);
  const activeGroup = groups.find((group) =>
    group.items.some((section) => section.href === activeHref),
  )?.id;
  // undefined = suivre automatiquement la route active ; null = tout replier ;
  // un identifiant = forcer l'ouverture du groupe choisi par l'administrateur.
  const [openGroup, setOpenGroup] = useState<string | null | undefined>(undefined);
  const expandedGroup = openGroup === undefined ? activeGroup : openGroup;

  return (
    <nav className="admin-bento-nav" aria-label="Pages d’administration">
      {groups.map((group) => {
        const isOpen = expandedGroup === group.id;
        const isActive = activeGroup === group.id;
        const triggerId = `admin-nav-${group.id}-trigger`;
        const panelId = `admin-nav-${group.id}-panel`;

        return (
          <section
            className={`admin-bento-nav-group${isActive ? " is-active" : ""}${isOpen ? " is-open" : ""}`}
            key={group.id}
          >
            <button
              id={triggerId}
              type="button"
              className="admin-bento-nav-group-toggle"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenGroup(isOpen ? null : group.id)}
            >
              <span className="admin-bento-nav-group-label">{group.label}</span>
              <span className="admin-bento-nav-group-count" aria-hidden="true">
                {String(group.items.length).padStart(2, "0")}
              </span>
              <span className="admin-bento-nav-group-chevron" aria-hidden="true">⌄</span>
            </button>

            <div
              id={panelId}
              className="admin-bento-nav-group-panel"
              aria-labelledby={triggerId}
              hidden={!isOpen}
            >
              {group.items.map((section) => {
                const active = activeHref === section.href;
                const exact = pathname === section.href;

                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    className={`admin-bento-nav-link${active ? " is-active" : ""}`}
                    aria-current={active ? (exact ? "page" : "location") : undefined}
                    onClick={() => setOpenGroup(undefined)}
                  >
                    <span className="admin-bento-nav-copy">
                      <strong>{section.label}</strong>
                      <small>{section.note}</small>
                    </span>
                    <span className="admin-bento-nav-arrow" aria-hidden="true">↗</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
