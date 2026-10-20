"use client";

import { usePathname } from "next/navigation";

type Section = "clients" | "assurances" | "historique" | "annulations" | "rapports" | "profil" | "notifications" | "service";

const groups: Record<string, { title: string; tabs: { id: string; label: string; href: string; description: string }[] }> = {
  clients: {
    title: "Clients et assurances",
    tabs: [
      { id: "clients", label: "Répertoire & crédits", href: "/pharmacie/caisse/clients", description: "Fiches clients et encours" },
      { id: "assurances", label: "Assurances & tiers payant", href: "/pharmacie/caisse/assurances", description: "Couvertures et dossiers" },
      { id: "annulations", label: "Demandes d’annulation", href: "/pharmacie/caisse/annulations", description: "Suivi des demandes" },
      { id: "notifications", label: "Notifications", href: "/pharmacie/caisse/notifications", description: "Alertes personnelles et pharmacie" },
    ],
  },
  assurances: {
    title: "Clients et assurances",
    tabs: [
      { id: "clients", label: "Répertoire & crédits", href: "/pharmacie/caisse/clients", description: "Fiches clients et encours" },
      { id: "assurances", label: "Assurances & tiers payant", href: "/pharmacie/caisse/assurances", description: "Couvertures et dossiers" },
      { id: "annulations", label: "Demandes d’annulation", href: "/pharmacie/caisse/annulations", description: "Suivi des demandes" },
      { id: "notifications", label: "Notifications", href: "/pharmacie/caisse/notifications", description: "Alertes personnelles et pharmacie" },
    ],
  },
  historique: {
    title: "Ventes et tickets",
    tabs: [
      { id: "historique", label: "Historique des ventes", href: "/pharmacie/caisse/historique", description: "Recherche et duplicata" },
      { id: "annulations", label: "Annulations", href: "/pharmacie/caisse/annulations", description: "Demandes et décisions" },
      { id: "rapports", label: "Synthèse des ventes", href: "/pharmacie/caisse/rapports", description: "Indicateurs calculés" },
    ],
  },
  annulations: {
    title: "Ventes et tickets",
    tabs: [
      { id: "historique", label: "Historique des ventes", href: "/pharmacie/caisse/historique", description: "Recherche et duplicata" },
      { id: "annulations", label: "Annulations", href: "/pharmacie/caisse/annulations", description: "Demandes et décisions" },
      { id: "rapports", label: "Synthèse des ventes", href: "/pharmacie/caisse/rapports", description: "Indicateurs calculés" },
    ],
  },
  rapports: {
    title: "Rapports et performances",
    tabs: [
      { id: "rapports", label: "Vue d’ensemble", href: "/pharmacie/caisse/rapports", description: "Chiffres issus des ventes accessibles" },
      { id: "historique", label: "Ventes détaillées", href: "/pharmacie/caisse/historique", description: "Tickets et filtres" },
      { id: "service", label: "Sessions de caisse", href: "/pharmacie/caisse/service", description: "Ouvertures et clôtures" },
    ],
  },
  service: {
    title: "Prise et fin de service",
    tabs: [
      { id: "service", label: "Mes sessions", href: "/pharmacie/caisse/service", description: "Historique du service" },
      { id: "dashboard", label: "Poste de caisse", href: "/pharmacie/caisse", description: "Ouverture, vente et clôture" },
      { id: "rapports", label: "Rapports", href: "/pharmacie/caisse/rapports", description: "Synthèse des sessions et ventes" },
    ],
  },
  profil: {
    title: "Mon compte",
    tabs: [
      { id: "profil", label: "Informations & sécurité", href: "/pharmacie/caisse/profil", description: "Identité et vérification PIN" },
      { id: "notifications", label: "Notifications", href: "/pharmacie/caisse/notifications", description: "Alertes du compte" },
      { id: "service", label: "Historique de service", href: "/pharmacie/caisse/service", description: "Sessions du compte" },
    ],
  },
  notifications: {
    title: "Notifications et suivi",
    tabs: [
      { id: "notifications", label: "Notifications", href: "/pharmacie/caisse/notifications", description: "Alertes et états de lecture" },
      { id: "clients", label: "Crédits clients", href: "/pharmacie/caisse/clients", description: "Encours à recouvrer" },
      { id: "assurances", label: "Dossiers assurance", href: "/pharmacie/caisse/assurances", description: "Tiers payant accessible" },
    ],
  },
};

export function CaisseSectionTabs({ section }: { section: Section }) {
  const pathname = usePathname();
  const group = groups[section];
  if (!group) return null;

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label={group.title}>
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{group.title}</p>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={"Onglets " + group.title}>
        {group.tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <a
              key={tab.id}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              title={tab.description}
              className={"min-h-11 shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition-colors " + (active ? "bg-[#0B3D26] text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50")}
            >
              {tab.label}
            </a>
          );
        })}
      </nav>
    </section>
  );
}
