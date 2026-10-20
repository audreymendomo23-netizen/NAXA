"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

type Screen =
  | "dashboard" | "clients" | "assurances" | "historique" | "ticket" | "annulation"
  | "service" | "ouverture" | "cloture" | "rapports" | "profil" | "securite"
  | "notifications" | "demandes" | "vente" | "favoris" | "paniers" | "ordonnances"
  | "reservations" | "stock" | "catalogue" | "lots" | "import" | "sortie"
  | "registre" | "offline" | "paiement" | "remise" | "assurance-vente"
  | "reception" | "commande" | "aide" | "verrouillage" | "deconnexion" | "garde" | "coffre" | "ordonnance-offline" | "pin" | "creances" | "alertes" | "fournisseurs" | "inventaire-refus" | "connexion" | "premiere-connexion" | "mot-de-passe-oublie";

const primary: { id: Screen; label: string; icon: string }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: "⌂" },
  { id: "clients", label: "Clients et Assurances", icon: "♙" },
  { id: "historique", label: "Historique des ventes", icon: "▤" },
  { id: "service", label: "Prise / fin de service", icon: "◷" },
  { id: "rapports", label: "Rapports & Performances", icon: "▥" },
  { id: "profil", label: "Profil", icon: "◉" },
  { id: "deconnexion", label: "Déconnexion", icon: "↪" },
];

const titles: Record<Screen, string> = {
  dashboard: "Tableau de bord", clients: "Clients et Assurances", assurances: "Assurances & tiers payant",
  historique: "Historique des ventes", ticket: "Détail et duplicata du ticket", annulation: "Demande d’annulation",
  service: "Prise / fin de service", ouverture: "Prendre mon service", cloture: "Clôture de caisse (Z)",
  rapports: "Rapports & Performances", profil: "Profil", securite: "Sécurité du compte",
  notifications: "Centre de notifications", demandes: "Mes demandes de validation", vente: "Nouvelle vente",
  favoris: "Favoris et caisse rapide", paniers: "Paniers en attente", ordonnances: "Ordonnances",
  reservations: "Réservations reçues", stock: "Mon stock", catalogue: "Catalogue par molécule",
  lots: "Lots et péremptions", import: "Import Excel / CSV", sortie: "Sortie exceptionnelle",
  registre: "Registre réglementé", offline: "Synchronisation et mode hors ligne",
  paiement: "Paiement", remise: "Remise et promotions", "assurance-vente": "Vente assurée",
  reception: "Réception et contrôle", commande: "Suggestion de réapprovisionnement",
  aide: "Aide et assistance", verrouillage: "Poste verrouillé", deconnexion: "Déconnexion", garde: "Statut de garde", coffre: "Coffre des ordonnances", "ordonnance-offline": "Ordonnance hors ligne", pin: "Validation PIN et sécurité", creances: "Créances et bordereaux — consultation", alertes: "Centre des alertes", fournisseurs: "Fournisseurs et dettes — consultation", "inventaire-refus": "Inventaire — accès réservé", connexion: "Connexion au compte caisse", "premiere-connexion": "Choisir le mot de passe", "mot-de-passe-oublie": "Mot de passe oublié",
};

// Seuls les parcours dont une interface opérationnelle existe dans le code sont raccordés.
// Ce pont navigue vers l'interface métier existante ; il ne transforme pas une maquette en mutation métier.
const OPERATIONAL_PATHS: Partial<Record<Screen, { path: string; label: string }>> = {
  dashboard: { path: "/pharmacie/caisse", label: "Poste de caisse" },
  vente: { path: "/pharmacie/caisse", label: "Vente et encaissement" },
  favoris: { path: "/pharmacie/caisse", label: "Vente et encaissement" },
  paniers: { path: "/pharmacie/caisse", label: "Poste de caisse" },
  paiement: { path: "/pharmacie/caisse", label: "Vente et encaissement" },
  reservations: { path: "/pharmacie/caisse", label: "Retraits Marketplace" },
  clients: { path: "/pharmacie/caisse/clients", label: "Répertoire clients et crédits" },
  assurances: { path: "/pharmacie/caisse/assurances", label: "Assurances et tiers payant" },
  "assurance-vente": { path: "/pharmacie/caisse/assurances", label: "Assurances et tiers payant" },
  historique: { path: "/pharmacie/caisse/historique", label: "Historique et tickets réels" },
  ticket: { path: "/pharmacie/caisse/historique", label: "Historique et tickets réels" },
  annulation: { path: "/pharmacie/caisse/annulations", label: "Demandes d'annulation" },
  service: { path: "/pharmacie/caisse/service", label: "Sessions de caisse" },
  ouverture: { path: "/pharmacie/caisse/service", label: "Ouverture de service" },
  cloture: { path: "/pharmacie/caisse/service", label: "Clôture de caisse" },
  rapports: { path: "/pharmacie/caisse/rapports", label: "Rapports caisse" },
  profil: { path: "/pharmacie/caisse/profil", label: "Profil du compte" },
  securite: { path: "/pharmacie/caisse/profil", label: "Sécurité du compte" },
  verrouillage: { path: "/pharmacie/caisse/profil", label: "Reprise et sécurité du compte" },
  pin: { path: "/pharmacie/caisse/profil", label: "PIN de reprise" },
  notifications: { path: "/pharmacie/caisse/notifications", label: "Notifications réelles" },
  creances: { path: "/pharmacie/caisse/clients", label: "Crédits et créances clients" },
};

const NOTIFICATION_ROLES = ["Tous les rôles","Caissier","Pharmacien","Assistant pharmacien","Magasinier","Gestionnaire de stock","Responsable","Promoteur","Administrateur NAXA","Comptable","Client"] as const;
const NOTIFICATION_DOMAINS = ["Tous les domaines","Vente et encaissement","Réservation et retrait","Client et assurance","Session et clôture","Historique et ticket","Stock et péremption","Ordonnance et conformité","Synchronisation hors ligne","Profil et sécurité","Demande et validation"] as const;
const NOTIFICATION_STATES = ["Information disponible","Action attendue","Confirmation requise","Échéance proche","Contrôle nécessaire","Opération en attente","Échec à traiter","Conflit détecté","Validation reçue","Suivi recommandé"] as const;

// 10 rôles × 10 domaines fonctionnels × 10 états = 1 000 scénarios de notification
// générés de façon déterministe pour le test d'architecture. Aucun envoi réel.
const notificationCases = NOTIFICATION_ROLES.slice(1).flatMap((role, roleIndex) =>
  NOTIFICATION_DOMAINS.slice(1).flatMap((domain, domainIndex) =>
    NOTIFICATION_STATES.map((state, stateIndex) => ({
      id: roleIndex * 100 + domainIndex * 10 + stateIndex + 1,
      role,
      domain,
      state,
      priority: stateIndex === 6 || stateIndex === 7 ? "À traiter" : stateIndex === 2 || stateIndex === 4 ? "Contrôle" : "Information",
      message: `${state} — ${domain.toLowerCase()} pour le rôle ${role.toLowerCase()}.`,
    }))
  )
);

function inferNotificationRole(label: string) {
  const value = label.toLocaleLowerCase("fr");
  if (/assur|assuré|tiers payant|créance|bordereau/.test(value)) return "Comptable";
  if (/stock|lot|péremption|réception|fournisseur|import|inventaire/.test(value)) return "Gestionnaire de stock";
  if (/ordonnance|pharmac|médicament|registre/.test(value)) return "Pharmacien";
  if (/responsable|validation|annulation|remise|sortie exceptionnelle/.test(value)) return "Responsable";
  if (/client|crédit/.test(value)) return "Caissier";
  if (/profil|sécurité|mot de passe|connexion|otp|déconnexion|verrouill/.test(value)) return "Caissier";
  if (/réservation|qr|retrait/.test(value)) return "Caissier";
  if (/paiement|encaissement|vente|ticket|caisse|session|service/.test(value)) return "Caissier";
  return "Caissier";
}

function inferNotificationDomain(label: string) {
  const value = label.toLocaleLowerCase("fr");
  if (/assur|assuré|tiers payant|créance|bordereau|client/.test(value)) return "Client et assurance";
  if (/stock|lot|péremption|réception|fournisseur|import|inventaire/.test(value)) return "Stock et péremption";
  if (/ordonnance|pharmac|médicament|registre/.test(value)) return "Ordonnance et conformité";
  if (/réservation|qr|retrait/.test(value)) return "Réservation et retrait";
  if (/historique|duplicata|ticket|impression/.test(value)) return "Historique et ticket";
  if (/hors ligne|synchron|réseau|conflit/.test(value)) return "Synchronisation hors ligne";
  if (/profil|sécurité|mot de passe|connexion|otp|déconnexion|verrouill/.test(value)) return "Profil et sécurité";
  if (/annulation|validation|demande|remise|sortie/.test(value)) return "Demande et validation";
  if (/ouverture|clôture|service|session/.test(value)) return "Session et clôture";
  return "Vente et encaissement";
}

const interfaceDirectory: { id: Screen; label: string; group: string }[] = [
  { id: "dashboard", label: "Tableau de bord", group: "Navigation principale" },
  { id: "clients", label: "Clients et Assurances", group: "Navigation principale" },
  { id: "historique", label: "Historique des ventes", group: "Navigation principale" },
  { id: "service", label: "Prise / fin de service", group: "Navigation principale" },
  { id: "rapports", label: "Rapports & Performances", group: "Navigation principale" },
  { id: "profil", label: "Profil", group: "Navigation principale" },
  { id: "deconnexion", label: "Déconnexion", group: "Navigation principale" },
  { id: "assurances", label: "Assurances & tiers payant", group: "Clients et ventes" },
  { id: "assurance-vente", label: "Vente assurée", group: "Clients et ventes" },
  { id: "vente", label: "Nouvelle vente", group: "Clients et ventes" },
  { id: "paiement", label: "Paiement", group: "Clients et ventes" },
  { id: "remise", label: "Remise et promotions", group: "Clients et ventes" },
  { id: "ticket", label: "Détail et duplicata du ticket", group: "Clients et ventes" },
  { id: "annulation", label: "Demande d’annulation", group: "Clients et ventes" },
  { id: "favoris", label: "Favoris et caisse rapide", group: "Clients et ventes" },
  { id: "paniers", label: "Paniers en attente", group: "Clients et ventes" },
  { id: "reservations", label: "Réservations reçues", group: "Marketplace et ordonnances" },
  { id: "ordonnances", label: "Ordonnances", group: "Marketplace et ordonnances" },
  { id: "coffre", label: "Coffre des ordonnances", group: "Marketplace et ordonnances" },
  { id: "ordonnance-offline", label: "Ordonnance hors ligne", group: "Marketplace et ordonnances" },
  { id: "catalogue", label: "Catalogue par molécule", group: "Stock et logistique" },
  { id: "stock", label: "Mon stock", group: "Stock et logistique" },
  { id: "lots", label: "Lots et péremptions", group: "Stock et logistique" },
  { id: "import", label: "Import Excel / CSV", group: "Stock et logistique" },
  { id: "reception", label: "Réception et contrôle", group: "Stock et logistique" },
  { id: "sortie", label: "Sortie exceptionnelle", group: "Stock et logistique" },
  { id: "commande", label: "Suggestion de réapprovisionnement", group: "Stock et logistique" },
  { id: "fournisseurs", label: "Fournisseurs et dettes", group: "Stock et logistique" },
  { id: "inventaire-refus", label: "Inventaire — accès réservé", group: "Stock et logistique" },
  { id: "ouverture", label: "Prendre mon service", group: "Session et sécurité" },
  { id: "cloture", label: "Clôture de caisse (Z)", group: "Session et sécurité" },
  { id: "securite", label: "Sécurité du compte", group: "Session et sécurité" },
  { id: "pin", label: "Validation PIN et sécurité", group: "Session et sécurité" },
  { id: "verrouillage", label: "Poste verrouillé", group: "Session et sécurité" },
  { id: "connexion", label: "Connexion au compte caisse", group: "Session et sécurité" },
  { id: "premiere-connexion", label: "Première connexion", group: "Session et sécurité" },
  { id: "mot-de-passe-oublie", label: "Mot de passe oublié", group: "Session et sécurité" },
  { id: "notifications", label: "Centre de notifications", group: "Suivi et assistance" },
  { id: "demandes", label: "Mes demandes de validation", group: "Suivi et assistance" },
  { id: "alertes", label: "Centre des alertes", group: "Suivi et assistance" },
  { id: "offline", label: "Synchronisation et mode hors ligne", group: "Suivi et assistance" },
  { id: "aide", label: "Aide et assistance", group: "Suivi et assistance" },
  { id: "garde", label: "Statut de garde", group: "Suivi et assistance" },
  { id: "creances", label: "Créances et bordereaux", group: "Suivi et assistance" },
  { id: "registre", label: "Registre réglementé", group: "Suivi et assistance" },
];

const shortcuts: { label: string; detail: string; target: Screen; icon: string }[] = [
  { label: "Nouvelle vente", detail: "Recherche, scan et panier", target: "vente", icon: "＋" },
  { label: "Ordonnances", detail: "File et statut de validation", target: "ordonnances", icon: "▧" },
  { label: "Réservations", detail: "Préparation et remise", target: "reservations", icon: "◷" },
  { label: "Mon stock", detail: "Produits, lots et alertes", target: "stock", icon: "▤" },
  { label: "Mes demandes", detail: "Suivi des décisions", target: "demandes", icon: "✓" },
  { label: "Clôturer ma caisse", detail: "Totaux et rapprochement", target: "cloture", icon: "⇥" },
  { label: "Paniers en attente", detail: "Reprendre un panier", target: "paniers", icon: "▣" },
  { label: "Favoris", detail: "Raccourcis produits", target: "favoris", icon: "★" },
  { label: "Synchronisation", detail: "File et conflits", target: "offline", icon: "↻" },
  { label: "Centre de notifications", detail: "Alertes et messages", target: "notifications", icon: "♧" },
  { label: "Statut de garde", detail: "État visible de la pharmacie", target: "garde", icon: "✦" },
  { label: "Coffre ordonnances", detail: "Consultation selon droits", target: "coffre", icon: "▣" },
  { label: "Mode dégradé", detail: "Saisie différée / carnet papier", target: "ordonnance-offline", icon: "⌁" },
  { label: "Créances assurance", detail: "Consultation et rejets", target: "creances", icon: "▥" },
];

function Action({ children, onClick, variant = "primary" }: { children: ReactNode; onClick: () => void; variant?: "primary" | "light" | "warning" | "danger" }) {
  const styles = {
    primary: "bg-[#0b3d26] text-white hover:bg-[#145b39]",
    light: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    warning: "border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100",
    danger: "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
  };
  return <button type="button" onClick={onClick} className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-bold transition ${styles[variant]}`}>{children}</button>;
}

function Panel({ title, subtitle, children, right }: { title: string; subtitle?: string; children: ReactNode; right?: ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-extrabold text-slate-900">{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>{right}</div>{children}</section>;
}

function Field({ label, placeholder = "Saisie de démonstration" }: { label: string; placeholder?: string }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<input placeholder={placeholder} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" /></label>;
}

function Empty({ title = "Aucun élément de démonstration", body = "Cet état visuel sera alimenté lorsque les fonctionnalités seront connectées." }: { title?: string; body?: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-white text-xl text-slate-400">⌕</div><p className="font-bold text-slate-800">{title}</p><p className="mt-1 text-sm text-slate-500">{body}</p></div>;
}

function TableMock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t border-slate-100">{row.map((cell, j) => <td key={j} className="p-3 text-slate-700">{cell}</td>)}</tr>)}</tbody></table></div>;
}

function Status({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  const styles = { slate: "bg-slate-100 text-slate-700", green: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-900", red: "bg-red-50 text-red-800", blue: "bg-blue-50 text-blue-800" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>;
}

export default function CaisseParcoursPrototypePage() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [toast, setToast] = useState("Prototype de parcours : navigation locale uniquement, aucune opération métier exécutée.");
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState<"FR" | "EN">("FR");
  const [demoDialog, setDemoDialog] = useState("");
  const [notificationRole, setNotificationRole] = useState<string>("Caissier");
  const [notificationDomain, setNotificationDomain] = useState<string>("Tous les domaines");
  const [notificationCursor, setNotificationCursor] = useState(0);
  const [readNotificationIds, setReadNotificationIds] = useState<number[]>([]);
  const activePrimary = useMemo(() => {
    if (["assurances"].includes(screen)) return "clients";
    if (["ticket", "annulation"].includes(screen)) return "historique";
    if (["ouverture", "cloture"].includes(screen)) return "service";
    if (["securite"].includes(screen)) return "profil";
    if (["notifications", "demandes"].includes(screen)) return "clients";
    return primary.some(x => x.id === screen) ? screen : "dashboard";
  }, [screen]);
  const go = (target: Screen) => {
    setScreen(target);
    setToast(`Écran « ${titles[target]} » ouvert dans le prototype. Aucune donnée ni opération réelle n’a été modifiée.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const demoAction = (label: string) => {
    setDemoDialog(label);
    setNotificationRole(inferNotificationRole(label));
    setNotificationDomain(inferNotificationDomain(label));
    setNotificationCursor(0);
  };
  const closeDialog = () => setDemoDialog("");
  const visibleNotificationCases = notificationCases.filter(item =>
    (notificationRole === "Tous les rôles" || item.role === notificationRole) &&
    (notificationDomain === "Tous les domaines" || item.domain === notificationDomain)
  );
  const safeNotificationCursor = visibleNotificationCases.length
    ? notificationCursor % visibleNotificationCases.length
    : 0;
  const currentNotification = visibleNotificationCases[safeNotificationCursor];
  const advanceNotification = (step: number) => {
    if (!visibleNotificationCases.length) return;
    setNotificationCursor((current) =>
      (current + step + visibleNotificationCases.length) % visibleNotificationCases.length
    );
  };
  const markCurrentNotificationRead = () => {
    if (currentNotification) {
      setReadNotificationIds(current =>
        current.includes(currentNotification.id) ? current : [...current, currentNotification.id]
      );
    }
  };

  const rowActions = (target: Screen, label: string) => <Action variant="light" onClick={() => go(target)}>{label} →</Action>;

  return <main className="min-h-screen bg-[#f3f7f4] text-slate-800">
    <div className="mx-auto max-w-[1680px] p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div><p className="font-extrabold">Prototype UI uniquement — aucune connexion métier</p><p className="mt-1">Les liens ouvrent les écrans du parcours. Les paiements, écritures, données, notifications et changements de compte restent simulés.</p></div>
        <Status tone="amber">Données fictives</Status>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="rounded-2xl bg-[#0b3d26] p-4 text-white shadow-lg lg:sticky lg:top-4">
          <button type="button" onClick={() => go("dashboard")} className="mb-5 flex w-full items-center gap-3 border-b border-white/15 px-1 pb-5 text-left">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ffe23d] text-xl font-black text-[#0b3d26]">N</span><span><strong className="block text-xl tracking-wide">NAXA</strong><small className="text-emerald-100">Espace caisse</small></span>
          </button>
          <div className="mb-4 rounded-xl bg-white/10 p-3"><p className="text-xs uppercase tracking-wider text-emerald-100">Espace de travail</p><p className="mt-1 font-bold">Compte caisse</p><p className="mt-1 text-xs text-emerald-100">Pharmacie de démonstration</p></div>
          <nav aria-label="Les sept entrées principales" className="space-y-1">
            {primary.map(item => <button type="button" key={item.id} onClick={() => go(item.id)} aria-current={activePrimary === item.id ? "page" : undefined} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${activePrimary === item.id ? "bg-[#ffe23d] text-[#0b3d26]" : item.id === "deconnexion" ? "mt-5 border border-white/20 text-white hover:bg-white/10" : "text-white/90 hover:bg-white/10"}`}><span className="grid w-6 place-items-center text-lg" aria-hidden="true">{item.icon}</span><span className="flex-1">{item.label}</span>{item.id === "clients" && <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#0b3d26]">—</span>}{item.id === "service" && <Status tone="amber">État</Status>}</button>)}
          </nav>
          <div className="mt-5 space-y-3 rounded-xl border border-white/15 p-3"><div className="flex items-center justify-between gap-2 text-xs"><span>Réseau</span><Status tone="green">Démo</Status></div><p className="text-xs text-emerald-100">Synchronisation : —</p><p className="text-xs text-emerald-100">Dernière sauvegarde : —</p><div className="flex gap-2"><Action variant="light" onClick={() => go("offline")}>File hors ligne</Action><Action variant="light" onClick={() => go("alertes")}>Alertes</Action><Action variant="light" onClick={() => go("aide")}>Aide</Action></div></div>
          <p className="mt-4 px-1 text-xs text-emerald-100">Maquette de parcours · non connectée</p>
        </aside>

        <div className="min-w-0 space-y-4">
          <header className="rounded-2xl bg-[#0f6b3f] p-4 text-white shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">NAXA · Parcours caissier</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{titles[screen]}</h1><p className="mt-2 text-sm text-emerald-50">Interface de présentation. Les contrôles naviguent entre écrans de démonstration.</p></div>
              <div className="flex flex-wrap items-center gap-2"><button type="button" className="min-h-11 rounded-xl border border-white/30 px-3 text-sm font-bold" onClick={() => setLocale(locale === "FR" ? "EN" : "FR")}>{locale} / {locale === "FR" ? "EN" : "FR"}</button><Action variant="light" onClick={() => go("notifications")}>♧ Notifications <span className="ml-1 rounded-full bg-[#ffe23d] px-2 text-[#0b3d26]">3</span></Action><Action variant="light" onClick={() => go("aide")}>? Aide</Action><Action variant="light" onClick={() => go("verrouillage")}>▣ Verrouiller</Action></div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-emerald-100">Pharmacie</p><p className="mt-1 font-bold">Pharmacie de démonstration</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-emerald-100">Compte</p><p className="mt-1 font-bold">Caissier · démo</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-emerald-100">État réseau</p><p className="mt-1 font-bold">État illustratif</p></div></div>
          </header>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            <Action variant="light" onClick={() => go("dashboard")}>⌂ Accueil</Action>
            <Action variant="light" onClick={() => go("vente")}>＋ Vente</Action>
            <Action variant="light" onClick={() => go("ordonnances")}>▧ Ordonnances</Action>
            <Action variant="light" onClick={() => go("reservations")}>◷ Réservations</Action>
            <Action variant="light" onClick={() => go("stock")}>▤ Stock</Action>
            <Action variant="light" onClick={() => go("demandes")}>✓ Mes demandes</Action>
            <Action variant="light" onClick={() => go("cloture")}>⇥ Clôture</Action>
            <Action variant="light" onClick={() => go("garde")}>✦ Statut de garde</Action>
            <Action variant="light" onClick={() => go("coffre")}>▣ Coffre ordonnances</Action>
          </div>

          {toast && <div role="status" aria-live="polite" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{toast}</div>}

          {screen === "dashboard" && <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Mes ventes aujourd’hui", "— FCFA", "Vos ventes uniquement"], ["Tickets émis", "—", "Nombre du jour"], ["Panier moyen", "— FCFA", "Valeur de démonstration"], ["Session de caisse", "État démo", "Prise / fin de service"]].map(([a,b,c]) => <div key={a} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{a}</p><p className="mt-3 text-2xl font-black text-slate-900">{b}</p><p className="mt-1 text-xs text-slate-500">{c}</p></div>)}</div>
            <Panel title="Actions rapides" subtitle="Chaque tuile ouvre l’interface correspondante."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shortcuts.map(x => <button type="button" key={x.label} onClick={() => go(x.target)} className="flex min-h-24 items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-emerald-700 hover:bg-emerald-50"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xl font-black text-emerald-800">{x.icon}</span><span><strong className="block text-sm">{x.label}</strong><small className="mt-1 block text-slate-500">{x.detail}</small></span><span className="ml-auto">→</span></button>)}</div></Panel>
            <div className="grid gap-4 xl:grid-cols-2"><Panel title="Activité horaire" subtitle="Graphique illustratif, sans valeurs métier"><div className="flex h-36 items-end gap-2 border-b border-l border-slate-200 px-3">{[28,42,35,62,48,73,55,84,60,69,46,58].map((h,i)=><span key={i} className="flex-1 rounded-t-md bg-emerald-600" style={{height:h+"%"}} />)}</div><div className="mt-2 flex justify-between text-xs text-slate-400"><span>08 h</span><span>12 h</span><span>16 h</span><span>20 h</span></div></Panel><Panel title="Produits en alerte" subtitle="Les actions ouvrent les écrans de détail"><div className="space-y-3">{[["Stock bas","stock"],["Lot proche de péremption","lots"],["Prix manquant","commande"]].map(([label,target])=><div key={label} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 last:border-0"><span>{label}</span><Action variant="light" onClick={() => go(target as Screen)}>Consulter →</Action></div>)}</div></Panel></div>
          </div>}

          {screen === "vente" && <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Recherche et scan" subtitle="Caméra et lecteur non activés"><div className="flex flex-wrap gap-2"><input value={query} onChange={e=>setQuery(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3" placeholder="Nom, molécule ou code-barres…" /><Action onClick={() => demoAction("Scanner / caméra : périphérique non connecté")}>▣ Scanner</Action></div><div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"><span className="text-3xl">▧</span><p className="mt-2 font-bold">Zone de visée du scanner</p><p className="mt-1 text-sm text-slate-500">Saisie manuelle ou caméra prévue dans le parcours.</p></div><div className="mt-4"><TableMock headers={["Produit","Contrôles","Prix","Action"]} rows={[[query || "Produit recherché","Stock · péremption · ordonnance","— FCFA","Aperçu"],["Alternative générique","À contrôler","— FCFA","Aperçu"]]} /></div><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => go("catalogue")}>Chercher par molécule</Action><Action variant="light" onClick={() => go("favoris")}>Favoris / caisse rapide</Action><Action variant="light" onClick={() => go("ordonnances")}>Ajouter ordonnance</Action><Action variant="light" onClick={() => go("ordonnance-offline")}>Ordonnance hors ligne</Action></div></Panel><Panel title="Panier" subtitle="Aucune ligne réelle"><Empty title="Panier de démonstration vide" body="Les articles, prix, quantités et contrôles seront alimentés lors de la connexion métier."/><div className="mt-4 grid grid-cols-2 gap-2"><Action variant="light" onClick={() => go("paniers")}>Mettre en attente / reprendre</Action><Action variant="light" onClick={() => go("remise")}>Remise</Action><Action variant="light" onClick={() => go("assurance-vente")}>Client / assurance</Action><Action onClick={() => go("paiement")}>Passer au paiement →</Action><Action variant="danger" onClick={() => demoAction("Vider le panier : action désactivée dans le prototype")}>Vider le panier</Action></div></Panel></div>}

          {screen === "favoris" && <Panel title="Favoris et caisse rapide" subtitle="Raccourcis clavier prévus : F2 recherche · F4 paiement"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{["Favori produit A","Favori produit B","Favori produit C","Favori produit D","Favori produit E","Favori produit F"].map((x,i)=><button key={x} onClick={() => demoAction("Ajout au panier simulé : "+x)} className="flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-emerald-50"><span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-2xl">★</span><span><strong>{x}</strong><small className="block text-slate-500">Prix — · stock —</small></span></button>)}</div><div className="mt-4"><Panel title="Écran client" subtitle="Aperçu de l’affichage externe"><div className="rounded-xl bg-slate-950 p-6 text-center text-white"><p className="text-sm">BIENVENUE À LA PHARMACIE</p><p className="mt-5 text-3xl font-black">TOTAL : — FCFA</p><p className="mt-3 text-xs text-slate-300">Affichage de démonstration</p></div></Panel></div></Panel>}

          {screen === "paniers" && <Panel title="Paniers en attente" subtitle="Un panier en attente expire en fin de journée selon le cahier des charges."><div className="mb-4 flex flex-wrap gap-2"><Field label="Rechercher un nom ou une référence" placeholder="Nom / référence" /><Action variant="light" onClick={() => demoAction("Filtre des paniers appliqué uniquement à la maquette")}>Filtrer</Action></div><Empty title="Aucun panier en attente" body="Les boutons Reprendre et Supprimer apparaîtront sur chaque panier disponible."/><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => go("vente")}>Retour à la vente</Action><Action variant="danger" onClick={() => demoAction("Suppression de panier désactivée")}>Supprimer le panier sélectionné</Action></div></Panel>}

          {screen === "paiement" && <div className="grid gap-4 xl:grid-cols-2"><Panel title="Encaissement" subtitle="Modes de paiement et calculs à connecter"><div className="grid gap-3 sm:grid-cols-2">{["Espèces","Mobile Money","Assurance / tiers payant","Crédit client","Bon / avoir","Paiement mixte"].map(x=><button key={x} onClick={() => demoAction("Mode de paiement sélectionné en maquette : "+x)} className="min-h-12 rounded-xl border border-slate-200 p-3 text-left font-bold hover:bg-emerald-50">{x} →</button>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Montant remis (FCFA)" /><Field label="Référence Mobile Money" /><Field label="Client / bon" /></div><div className="mt-4 rounded-xl bg-slate-50 p-4"><div className="flex justify-between"><span>Total à payer</span><strong>— FCFA</strong></div><div className="mt-2 flex justify-between"><span>Monnaie à rendre</span><strong>— FCFA</strong></div></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => go("ticket")}>Valider paiement (aperçu) → ticket</Action><Action variant="light" onClick={() => go("vente")}>Retour panier</Action></div></Panel><Panel title="Message d’erreur / confirmation"><div className="space-y-3"><div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><strong>Erreur de paiement — exemple</strong><p className="mt-1">Le paiement ne peut pas être confirmé dans le prototype.</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Confirmation — exemple</strong><p className="mt-1">En situation réelle, un ticket serait présenté après validation du paiement.</p></div></div></Panel></div>}

          {screen === "ticket" && <Panel title="Aperçu du ticket" subtitle="Aucun ticket réel créé"><div className="mx-auto max-w-md border border-dashed border-slate-300 p-5 font-mono text-sm"><div className="text-center"><strong className="text-lg">NAXA</strong><p>Pharmacie de démonstration</p><p>Ticket : DÉMO-0000</p><p>Date : —</p></div><hr className="my-3 border-dashed"/><p>Produit · quantité · prix unitaire</p><div className="my-3 space-y-1"><p>Sous-total : — FCFA</p><p>Remise : — FCFA</p><p>Mode : —</p><p className="font-black">TOTAL : — FCFA</p></div><hr className="my-3 border-dashed"/><p className="text-center">Merci de votre visite</p></div><div className="mt-4 flex flex-wrap justify-center gap-2"><Action variant="light" onClick={() => demoAction("Impression non connectée")}>Imprimer</Action><Action variant="light" onClick={() => demoAction("Export PDF non connecté")}>PDF</Action><Action variant="light" onClick={() => demoAction("Partage WhatsApp non connecté")}>WhatsApp</Action><Action onClick={() => go("vente")}>Nouvelle vente</Action></div></Panel>}

          {screen === "remise" && <Panel title="Remise et promotions" subtitle="Aucun montant n’est calculé ou appliqué"><div className="grid gap-3 sm:grid-cols-2"><Field label="Remise en pourcentage" placeholder="Ex. 5 %" /><Field label="Ou montant (FCFA)" /><Field label="Motif obligatoire" /><Field label="Plafond autorisé (rappel)" placeholder="À connecter" /></div><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Une remise supérieure au plafond doit être présentée au promoteur pour décision.</div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Demande de remise enregistrée uniquement dans l’interface de démonstration")}>Demander validation promoteur</Action><Action variant="light" onClick={() => go("vente")}>Retour au panier</Action></div></Panel>}

          {screen === "ordonnances" && <div className="space-y-4"><Panel title="Ordonnances — file de la caisse" subtitle="Statuts, lien à la vente et pièces"><div className="flex flex-wrap gap-2"><Action onClick={() => demoAction("Sélecteur photo / import non connecté")}>＋ Ajouter une ordonnance (photo / import)</Action><Action variant="light" onClick={() => demoAction("Visionneuse d’ordonnance non connectée")}>Ouvrir l’aperçu</Action></div><div className="mt-4"><TableMock headers={["Référence","Vente liée","Date","Statut","Action"]} rows={[[ "ORD-DÉMO-01","Vente démo","—","En attente", "Voir détail"],["ORD-DÉMO-02","Vente démo","—","Validée", "Historique"]]}/></div><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Le rôle caisse ne valide pas une ordonnance. L’encaissement d’un produit réglementé reste bloqué jusqu’à la décision du professionnel habilité.</div></Panel><Panel title="Détail d’une ordonnance" subtitle="Visionneuse et statut de validation"><div className="grid gap-4 md:grid-cols-[180px_1fr]"><div className="grid min-h-48 place-items-center rounded-xl bg-slate-100 text-5xl">▧</div><div><p className="font-bold">Pièce jointe de démonstration</p><p className="mt-1 text-sm text-slate-500">Zoom, statut, vente liée et motif de rejet sont prévus.</p><div className="mt-3 flex flex-wrap gap-2"><Action variant="light" onClick={() => demoAction("Zoom de document indisponible dans la maquette")}>Zoom +</Action><Action variant="light" onClick={() => demoAction("Motif de rejet affiché en exemple")}>Motif de rejet</Action><Action variant="light" onClick={() => go("vente")}>Retour à la vente</Action></div></div></div></Panel></div>}

          {screen === "reservations" && <Panel title="Réservations reçues" subtitle="Nouvelle · prête · remise · expirée"><div className="mb-4 grid gap-3 sm:grid-cols-3">{[["À préparer","—"],["Prêtes","—"],["Expirées","—"]].map(([a,b])=><div key={a} className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-500">{a}</p><p className="mt-1 text-xl font-black">{b}</p></div>)}</div><TableMock headers={["Référence","Client","Articles","Échéance","Statut","Action"]} rows={[[ "RES-DÉMO-01","Client de démonstration","—","—","Nouvelle","Voir détail"],["RES-DÉMO-02","Client de démonstration","—","—","Prête","Voir détail"]]}/><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Statut Prête simulé : aucune réservation modifiée")}>Marquer prête (aperçu)</Action><Action variant="light" onClick={() => demoAction("Remise au client non exécutée")}>Remise au client</Action><Action variant="danger" onClick={() => demoAction("Annulation non exécutée ; motif requis en situation réelle")}>Annuler (motif)</Action></div></Panel>}

          {screen === "stock" && <div className="space-y-4"><Panel title="Mon stock" subtitle="Prix d’achat et marges exclus du compte caisse"><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><input className="min-h-11 rounded-xl border border-slate-200 px-3" placeholder="Produit, code-barres, molécule…" value={query} onChange={e=>setQuery(e.target.value)}/><Action onClick={() => go("catalogue")}>Catalogue par molécule</Action></div><div className="mt-4"><TableMock headers={["Produit","Dosage / forme","Prix de vente","Quantité","Statut","Action"]} rows={[[query || "Produit démo","Dosage / forme","— FCFA","—","Stock bas","Détail"],["Produit démo B","Dosage / forme","— FCFA","—","Disponible","Détail"],["Produit démo C","Dosage / forme","— FCFA","—","Proche péremption","Détail"]]}/></div><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => go("lots")}>Lots et péremptions</Action><Action variant="light" onClick={() => go("import")}>Importer Excel / CSV</Action><Action variant="light" onClick={() => go("reception")}>Entrée / réception de stock</Action><Action variant="light" onClick={() => go("sortie")}>Sortie exceptionnelle</Action><Action variant="light" onClick={() => go("registre")}>Registre réglementé</Action><Action variant="light" onClick={() => go("offline")}>File hors ligne</Action><Action variant="light" onClick={() => go("inventaire-refus")}>Inventaire (accès limité)</Action></div></Panel><Panel title="Alertes de stock" subtitle="Chaque catégorie ouvre une vue détaillée"><div className="flex flex-wrap gap-2"><Action variant="light" onClick={() => go("lots")}>Lots proches de péremption</Action><Action variant="light" onClick={() => go("commande")}>Produits sans prix / réapprovisionnement</Action><Action variant="light" onClick={() => go("demandes")}>Commentaires et demandes</Action></div></Panel></div>}

          {screen === "catalogue" && <Panel title="Catalogue par molécule" subtitle="DCI, code ATC, dosage, forme, marque et générique"><div className="mb-4 grid gap-3 sm:grid-cols-2"><Field label="Molécule / DCI" /><Field label="Code ATC / code produit" /></div><TableMock headers={["DCI / ATC","Présentation","Marque / générique","Prix vente","Stock","Source / date"]} rows={[[ "Molécule démo","Dosage · forme","Générique","— FCFA","—","À connecter"],["Molécule démo","Dosage · forme","Marque","— FCFA","—","À connecter"]]}/><div className="mt-4 flex gap-2"><Action variant="light" onClick={() => go("vente")}>Ajouter à la vente (aperçu)</Action><Action variant="light" onClick={() => go("stock")}>Retour au stock</Action></div></Panel>}

          {screen === "lots" && <Panel title="Lots, péremptions et alertes" subtitle="Détail des lots non visible au client"><TableMock headers={["Produit","Lot","Péremption","Quantité","Jours restants","Statut"]} rows={[[ "Produit démo","LOT-DÉMO","—","—","—","À surveiller"],["Produit démo B","LOT-DÉMO","—","—","—","Alerte"]]}/><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => go("commande")}>Promotion / réapprovisionnement</Action><Action variant="light" onClick={() => go("sortie")}>Demander une sortie</Action><Action variant="light" onClick={() => go("alertes")}>Voir alertes liées</Action></div></Panel>}

          {screen === "import" && <Panel title="Assistant d’import Excel / CSV" subtitle="Aucun fichier n’est transmis ou analysé"><div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center"><span className="text-3xl">⇧</span><p className="mt-2 font-bold">Déposer un fichier ou choisir un fichier</p><p className="mt-1 text-sm text-slate-500">Zone de dépôt visuelle uniquement</p><div className="mt-3"><Action onClick={() => demoAction("Sélecteur de fichier non activé")}>Choisir un fichier</Action></div></div><div className="mt-4"><TableMock headers={["Colonne source","Champ cible","Contrôle","État"]} rows={[[ "Nom produit","Produit","Correspondance","À vérifier"],["Quantité","Quantité","Entier positif","À vérifier"],["Lot / péremption","Traçabilité","Champs requis","À vérifier"]]}/></div><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => demoAction("Modèle de fichier non généré")}>Télécharger modèle</Action><Action variant="light" onClick={() => demoAction("Contrôle de fichier non exécuté")}>Contrôler</Action><Action variant="danger" onClick={() => demoAction("Import annulé : aucune opération réelle")}>Annuler l’import</Action></div></Panel>}

          {screen === "sortie" && <Panel title="Sortie exceptionnelle" subtitle="Casse, péremption ou autre motif : soumission simulée"><div className="grid gap-3 sm:grid-cols-2"><Field label="Produit" /><Field label="Lot" /><Field label="Quantité" /><Field label="Motif" placeholder="Casse / périmé / autre" /><Field label="Note / justification" /></div><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">La demande est présentée au promoteur ; aucune quantité de stock ne change dans ce prototype.</div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Demande de sortie simulée, non enregistrée")}>Envoyer la demande (aperçu)</Action><Action variant="light" onClick={() => go("demandes")}>Voir mes demandes</Action><Action variant="light" onClick={() => go("pin")}>PIN / validation</Action></div></Panel>}

          {screen === "registre" && <Panel title="Registre réglementé" subtitle="Consultation visuelle — exigences locales à valider avant mise en service"><div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">Produit réglementé : aucune dispensation ne doit contourner la validation requise.</div><div className="mt-4"><TableMock headers={["Date","Produit","Lot","Entrée","Sortie","Solde","Ordonnance","Validateur"]} rows={[[ "—","Produit réglementé démo","—","—","—","—","—","—"]]}/></div><div className="mt-4"><Action variant="light" onClick={() => demoAction("Export du registre non connecté")}>Exporter le registre (aperçu)</Action></div></Panel>}

          {screen === "reception" && <Panel title="Réception et contrôle" subtitle="Aucune entrée de stock ne sera créée"><div className="grid gap-3 sm:grid-cols-2"><Field label="Fournisseur" /><Field label="Numéro du bon de livraison" /><Field label="Date de réception" /><Field label="Produit" /><Field label="Quantité reçue" /><Field label="Numéro de lot" /><Field label="Date de péremption" /></div><div className="mt-4"><TableMock headers={["Produit","Commandé","Reçu","Écart","Lot / péremption"]} rows={[[ "Produit démo","—","—","—","À renseigner"]]}/></div><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => demoAction("Ajout de ligne simulé")}>Ajouter une ligne</Action><Action onClick={() => demoAction("Validation de réception désactivée")}>Valider la réception (aperçu)</Action></div></Panel>}

          {screen === "commande" && <Panel title="Suggestion de réapprovisionnement" subtitle="Alertes de rupture, produits sans prix et proposition fournisseur"><TableMock headers={["Produit","Stock","Quantité suggérée","Fournisseur","Statut"]} rows={[[ "Produit démo","—","—","—","Brouillon"],["Produit démo B","—","—","—","À revoir"]]}/><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => demoAction("Commande fournisseur non créée")}>Préparer commande</Action><Action variant="light" onClick={() => demoAction("Envoi WhatsApp non connecté")}>Envoyer par WhatsApp</Action><Action variant="light" onClick={() => go("demandes")}>Demander un prix au promoteur</Action></div></Panel>}

          {screen === "clients" && <div className="space-y-4"><Panel title="Répertoire clients" subtitle="Recherche, fiches, crédits et état des comptes"><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><input className="min-h-11 rounded-xl border border-slate-200 px-3" placeholder="Nom, téléphone ou référence" value={query} onChange={e=>setQuery(e.target.value)}/><Action onClick={() => demoAction("Recherche affichée uniquement dans le prototype")}>Rechercher</Action></div><div className="mt-4"><TableMock headers={["Référence","Client","Crédit","État","Action"]} rows={[[ "CL-DÉMO-01","Client de démonstration","— FCFA","À connecter","Voir fiche"],["CL-DÉMO-02","Client de démonstration","— FCFA","À connecter","Voir fiche"]]}/></div><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => demoAction("Création de fiche client non connectée")}>Nouveau client</Action><Action variant="light" onClick={() => demoAction("Filtres de clients non connectés")}>Filtres</Action><Action variant="light" onClick={() => demoAction("Règlement de crédit non exécuté")}>Encaisser un crédit</Action><Action onClick={() => go("assurances")}>Assurances & tiers payant →</Action></div></Panel><Panel title="Crédits clients" subtitle="Encours, plafond et échéances"><TableMock headers={["Client","Solde","Plafond","Échéance","Action"]} rows={[[ "Client de démonstration","— FCFA","— FCFA","—","Détail"]]}/><Action variant="light" onClick={() => demoAction("Historique des crédits non connecté")}>Voir l’historique des crédits</Action></Panel></div>}

          {screen === "assurances" || screen === "assurance-vente" ? <div className="space-y-4"><Panel title={screen === "assurances" ? "Assurances & tiers payant" : "Vente assurée"} subtitle="Vérification d’éligibilité et partage client / assureur"><div className="grid gap-3 sm:grid-cols-2"><Field label="Assureur / mutuelle" /><Field label="Matricule adhérent" /><Field label="Numéro de couverture" /><Field label="Plafond restant" /></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Vérification externe de droits non connectée")}>Vérifier les droits</Action><Action variant="light" onClick={() => demoAction("Sélection de pièces justificatives non connectée")}>Pièces à fournir</Action><Action variant="light" onClick={() => go("clients")}>Retour aux clients</Action><Action variant="light" onClick={() => go("creances")}>Créances et rejets</Action></div><div className="mt-4"><TableMock headers={["Dossier","Total","Part assureur","Part client","Statut"]} rows={[[ "Dossier démo","— FCFA","— FCFA","— FCFA","À connecter"]]}/></div></Panel></div> : null}

          {screen === "historique" && <Panel title="Historique de mes ventes" subtitle="Recherche, filtres, détails, duplicata et annulation"><div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px_auto]"><input className="min-h-11 rounded-xl border border-slate-200 px-3" placeholder="Ticket, date, mode de paiement" value={query} onChange={e=>setQuery(e.target.value)}/><select className="min-h-11 rounded-xl border border-slate-200 px-3"><option>Tous les statuts</option><option>Payée</option><option>Brouillon</option><option>Annulée</option></select><Action variant="light" onClick={() => setQuery("")}>Réinitialiser</Action></div><TableMock headers={["Ticket","Date","Mode","Total","Statut","Actions"]} rows={[[ "NX-DÉMO-01","—","—","— FCFA","Payée","Détail / duplicata"],["NX-DÉMO-02","—","—","— FCFA","Brouillon","Détail"],["NX-DÉMO-03","—","—","— FCFA","Annulée","Voir motif"]]}/><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => go("ticket")}>Détail / duplicata</Action><Action variant="light" onClick={() => go("annulation")}>Demander une annulation</Action><Action variant="light" onClick={() => go("rapports")}>Synthèse des ventes</Action></div></Panel>}

          {screen === "annulation" && <Panel title="Demande d’annulation de vente" subtitle="La caisse demande ; un rôle habilité décide"><div className="grid gap-3 sm:grid-cols-2"><Field label="Numéro de ticket" /><Field label="Motif obligatoire" placeholder="Expliquez le motif" /></div><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">La vente n’est pas annulée tant que la demande n’a pas été examinée par le rôle habilité.</div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Demande présentée, mais non enregistrée")}>Envoyer la demande (aperçu)</Action><Action variant="light" onClick={() => go("demandes")}>Suivre le statut</Action><Action variant="light" onClick={() => go("historique")}>Retour à l’historique</Action></div></Panel>}

          {screen === "service" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{[["État de session","—"],["Fond initial","— FCFA"],["Écart de caisse","— FCFA"]].map(([a,b])=><div key={a} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{a}</p><p className="mt-2 text-xl font-black">{b}</p></div>)}</div><div className="grid gap-4 xl:grid-cols-2"><Panel title="Prise de service" subtitle="Fond initial et poste"><Field label="Fond initial (FCFA)" /><div className="mt-4"><Action onClick={() => go("ouverture")}>Ouvrir l’interface de prise de service →</Action></div></Panel><Panel title="Fin de service" subtitle="Rapprochement et clôture Z"><Field label="Montant compté (FCFA)" /><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => go("cloture")}>Clôturer ma caisse →</Action><Action variant="light" onClick={() => demoAction("Historique de session non connecté")}>Voir mes sessions</Action></div></Panel></div><Panel title="Sessions récentes"><Empty/></Panel></div>}

          {screen === "ouverture" && <Panel title="Prendre mon service" subtitle="Écran de confirmation visuel"><div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Vérifiez votre identité, votre poste et le fond initial avant de commencer.</div><div className="grid gap-3 sm:grid-cols-2"><Field label="Fond initial (FCFA)" /><Field label="Observation de prise de poste" /></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Ouverture de session non exécutée")}>Confirmer la prise de service</Action><Action variant="light" onClick={() => go("service")}>Retour</Action></div></Panel>}

          {screen === "cloture" && <div className="space-y-4"><Panel title="Clôture de caisse (Z)" subtitle="Totaux théoriques, montants comptés et écart"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{["Espèces","Mobile Money","Assurance","Crédit client"].map(x=><div key={x} className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-500">{x} théorique</p><p className="mt-2 text-xl font-black">— FCFA</p><Field label="Montant compté" placeholder="FCFA" /></div>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Motif de l’écart (si applicable)" /><Field label="Observation de clôture" /></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Clôture non enregistrée dans le prototype")}>Clôturer (aperçu)</Action><Action variant="light" onClick={() => demoAction("Rapport PDF non généré")}>Aperçu rapport PDF</Action><Action variant="light" onClick={() => go("service")}>Retour aux sessions</Action></div></Panel><Panel title="Ventes de la journée"><Empty title="Aucune vente réelle chargée" body="La liste inclura aussi les ventes saisies en différé, conformément au cahier des charges."/></Panel></div>}

          {screen === "rapports" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Ventes payées","—"],["Montant encaissé","— FCFA"],["Tickets émis","—"],["Sessions consultables","—"]].map(([a,b])=><div key={a} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{a}</p><p className="mt-2 text-2xl font-black">{b}</p><p className="mt-1 text-xs text-slate-400">Données non connectées</p></div>)}</div><div className="grid gap-4 xl:grid-cols-2"><Panel title="Ventes par heure"><div className="flex h-32 items-end gap-2">{[30,42,54,38,70,48,82,60].map((h,i)=><span key={i} className="flex-1 rounded-t-md bg-emerald-600" style={{height:h+"%"}}/>)}</div></Panel><Panel title="Répartition des paiements"><div className="space-y-3">{["Espèces","Mobile Money","Assurance","Crédit client"].map(x=><div key={x} className="flex justify-between border-b pb-2"><span>{x}</span><strong>—</strong></div>)}</div></Panel></div><Panel title="Top produits et alertes"><TableMock headers={["Produit","Quantité vendue","Total","Alerte"]} rows={[[ "Produit démo","—","— FCFA","Prix à renseigner"],["Produit démo B","—","— FCFA","Stock"]]}/><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => demoAction("Export PDF non connecté")}>Exporter PDF</Action><Action variant="light" onClick={() => demoAction("Export Excel non connecté")}>Exporter Excel</Action><Action variant="light" onClick={() => go("commande")}>Demander un prix</Action><Action variant="light" onClick={() => go("service")}>Rapport de fin de journée</Action></div></Panel></div>}

          {screen === "profil" && <div className="space-y-4"><div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]"><Panel title="Carte de profil" subtitle="Identité et rattachement"><div className="flex items-center gap-3"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-xl font-black text-emerald-900">CA</span><div><p className="font-extrabold">Compte caisse de démonstration</p><p className="text-sm text-slate-500">Pharmacie de démonstration</p><Status tone="green">État fictif</Status></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Nom affiché" /><Field label="Identifiant" /><Field label="Téléphone" /><Field label="Pharmacie" /></div></Panel><Panel title="Préférences d’affichage"><div className="flex flex-wrap gap-2"><Action variant="light" onClick={() => demoAction("Texte normal — préférence non enregistrée")}>Texte normal</Action><Action variant="light" onClick={() => demoAction("Texte agrandi — préférence non enregistrée")}>Texte agrandi</Action><Action variant="light" onClick={() => demoAction("Affichage compact — préférence non enregistrée")}>Affichage compact</Action><Action variant="light" onClick={() => demoAction("Mode léger — préférence non enregistrée")}>Mode léger</Action></div><div className="mt-4"><Action onClick={() => go("securite")}>Mot de passe & sécurité →</Action></div></Panel></div><Panel title="Activité récente" subtitle="Journal d’activité de démonstration"><TableMock headers={["Événement","Date","État"]} rows={[[ "Ouverture de service","—","Exemple"],["Clôture de service","—","Exemple"],["Préférence d’affichage","—","Exemple"]]}/></Panel></div>}

          {screen === "securite" && <Panel title="Sécurité du compte" subtitle="Champs visuels, aucune mise à jour Auth"><div className="grid gap-3 sm:grid-cols-2"><Field label="Mot de passe actuel" placeholder="••••••••" /><Field label="Nouveau mot de passe" placeholder="••••••••" /><Field label="Confirmer le mot de passe" placeholder="••••••••" /><Field label="PIN de caisse" placeholder="6 à 8 chiffres" /></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Modification de mot de passe désactivée")}>Mettre à jour</Action><Action variant="light" onClick={() => demoAction("Vérification du PIN non connectée")}>Vérifier le PIN</Action><Action variant="light" onClick={() => go("profil")}>Retour au profil</Action></div></Panel>}

          {screen === "demandes" && <div className="space-y-4"><Panel title="Mes demandes de validation" subtitle="Remises, sorties, annulations et prix à confirmer"><div className="mb-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => demoAction("Filtre Toutes sélectionné")}>Toutes</Action><Action variant="light" onClick={() => demoAction("Filtre En attente sélectionné")}>En attente</Action><Action variant="light" onClick={() => demoAction("Filtre Validées sélectionné")}>Validées</Action><Action variant="light" onClick={() => demoAction("Filtre Refusées sélectionné")}>Refusées</Action></div><TableMock headers={["Type","Date","Objet","Statut","Décideur","Action"]} rows={[[ "Prix","—","Produit démo","En attente","Promoteur","Détail"],["Annulation","—","Ticket démo","À instruire","Rôle habilité","Détail"],["Sortie exceptionnelle","—","Lot démo","Refusée","Promoteur","Motif"]]}/><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => go("notifications")}>Voir notifications</Action><Action variant="light" onClick={() => go("annulation")}>Nouvelle demande d’annulation</Action><Action variant="light" onClick={() => go("sortie")}>Nouvelle sortie exceptionnelle</Action></div></Panel></div>}

          {screen === "notifications" && <div className="space-y-4"><Panel title="Centre de notifications" subtitle="Alertes, demande liée et navigation vers l’objet"><div className="grid gap-3 sm:grid-cols-3">{[["Non lues","—"],["À traiter","—"],["Information","—"]].map(([a,b])=><div key={a} className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-500">{a}</p><p className="mt-1 text-xl font-black">{b}</p></div>)}</div><div className="mt-4 space-y-3">{[["Ordonnance en attente","Ordonnance · objet de démonstration","ordonnances"],["Réservation à préparer","Réservation · objet de démonstration","reservations"],["Décision sur une demande","Demande · objet de démonstration","demandes"],["Alerte de stock","Stock · objet de démonstration","stock"]].map(([a,b,target])=><div key={a} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-bold">{a}</p><p className="mt-1 text-sm text-slate-500">{b}</p></div><Action variant="light" onClick={() => go(target as Screen)}>Ouvrir l’objet →</Action></div>)}</div><div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Les notifications de démonstration ne sont pas envoyées et ne sont pas enregistrées.</div></Panel></div>}

          {screen === "offline" && <div className="space-y-4"><Panel title="Réseau et synchronisation" subtitle="États visuels requis par C0"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["En ligne","green"],["Hors ligne","amber"],["Synchronisation","blue"],["Conflit à traiter","red"]].map(([a,tone])=><div key={a} className="rounded-xl border border-slate-200 p-3"><Status tone={tone as "green"|"amber"|"blue"|"red"}>{a}</Status><p className="mt-2 text-sm text-slate-500">État d’exemple</p></div>)}</div><div className="mt-4"><TableMock headers={["Type","Heure","État","Objet"]} rows={[[ "Vente différée","—","En attente","Vente démo"],["Ordonnance","—","À transférer","Ordonnance démo"],["Mise à jour stock","—","Conflit","Produit démo"]]}/></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Forcer la synchronisation non connecté")}>Forcer la synchronisation</Action><Action variant="light" onClick={() => demoAction("Détail du conflit non connecté")}>Résoudre un conflit (aperçu)</Action><Action variant="light" onClick={() => go("vente")}>Saisie différée</Action></div></Panel></div>}

          {screen === "cloture" ? null : null}
          {screen === "aide" && <div className="space-y-4"><Panel title="Aide et assistance" subtitle="Entrées de support prévues"><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => demoAction("Guide caisse non connecté")} className="min-h-11 rounded-xl border p-4 text-left hover:bg-slate-50"><strong>Guide du poste de caisse</strong><p className="mt-1 text-sm text-slate-500">Ventes, tickets, clôture et sécurité</p></button><button type="button" onClick={() => demoAction("Contact support non connecté")} className="min-h-11 rounded-xl border p-4 text-left hover:bg-slate-50"><strong>Contacter le support</strong><p className="mt-1 text-sm text-slate-500">Décrire le problème rencontré</p></button><button type="button" onClick={() => demoAction("Règles de sécurité affichées en aperçu")} className="min-h-11 rounded-xl border p-4 text-left hover:bg-slate-50"><strong>Sécurité et confidentialité</strong><p className="mt-1 text-sm text-slate-500">Rappels de protection des données</p></button><button type="button" onClick={() => go("offline")} className="min-h-11 rounded-xl border p-4 text-left hover:bg-slate-50"><strong>État réseau</strong><p className="mt-1 text-sm text-slate-500">Synchronisation et conflits</p></button></div></Panel><Panel title="Répertoire des interfaces du compte caisse" subtitle="Chaque entrée ouvre directement l’écran correspondant du prototype. Les écrans réservés restent soumis à leurs contrôles métier réels, non simulés ici."><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[...new Set(interfaceDirectory.map(item => item.group))].map(group => <section key={group} className="rounded-xl border border-slate-200 p-3"><h3 className="mb-2 text-sm font-extrabold text-slate-700">{group}</h3><div className="space-y-2">{interfaceDirectory.filter(item => item.group === group).map(item => <button type="button" key={item.id} onClick={() => go(item.id)} aria-label={`Ouvrir l’interface ${item.label}`} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition hover:border-emerald-700 hover:bg-emerald-50 ${screen === item.id ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200"}`}><span>{item.label}</span><span aria-hidden="true">→</span></button>)}</div></section>)}</div><p className="mt-3 text-xs text-slate-500">{interfaceDirectory.length} accès directs répertoriés. Ce répertoire facilite la navigation de test ; il ne crée aucun droit métier.</p></Panel></div>}

          {screen === "verrouillage" && <Panel title="Poste verrouillé" subtitle="Interface de reprise, sans verrouillage Auth réel"><div className="mx-auto max-w-md text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-emerald-50 text-3xl">▣</div><p className="mt-4 text-lg font-extrabold">Votre poste est verrouillé</p><p className="mt-1 text-sm text-slate-500">Le panier en cours est conservé dans la maquette.</p><div className="mt-4 text-left"><Field label="Mot de passe ou PIN de reprise" placeholder="Saisie de démonstration"/></div><div className="mt-4 flex justify-center gap-2"><Action onClick={() => demoAction("Déverrouillage non connecté")}>Reprendre le poste</Action><Action variant="light" onClick={() => go("deconnexion")}>Déconnexion</Action><Action variant="light" onClick={() => go("mot-de-passe-oublie")}>Mot de passe oublié</Action></div></div></Panel>}


          {screen === "garde" && <Panel title="Statut « De garde »" subtitle="Visibilité et historique illustratifs ; aucun statut n’est modifié"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><Status tone="green">État de démonstration</Status><p className="mt-2 font-bold">Le statut de garde dépend des droits accordés au compte.</p><p className="mt-1 text-sm text-slate-600">En situation réelle, une confirmation et un horodatage seraient affichés après autorisation.</p></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Changement du statut de garde désactivé")}>Basculer le statut (aperçu)</Action><Action variant="light" onClick={() => demoAction("Confirmation de changement de garde non connectée")}>Confirmer</Action></div></Panel>}

          {screen === "coffre" && <Panel title="Coffre des ordonnances" subtitle="Accès contrôlé, visionneuse et journal des consultations"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">L’accès aux ordonnances doit être limité aux rôles autorisés et tracé. Aucune pièce médicale réelle n’est affichée.</div><div className="mt-4"><TableMock headers={["Date","Vente liée","Validateur","Échéance","Action"]} rows={[[ "—","Vente démo","Professionnel habilité","—","Ouvrir la visionneuse"]]}/></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Visionneuse sécurisée non connectée")}>Ouvrir la visionneuse</Action><Action variant="light" onClick={() => demoAction("Journal des consultations non connecté")}>Journal des consultations</Action><Action variant="light" onClick={() => go("ordonnances")}>Retour aux ordonnances</Action></div></Panel>}

          {screen === "ordonnance-offline" && <Panel title="Mode dégradé et ordonnance hors ligne" subtitle="Saisie différée et transfert en attente"><div className="grid gap-3 sm:grid-cols-2"><Field label="Date de l’événement (différé)" placeholder="JJ/MM/AAAA" /><Field label="Heure de l’événement" placeholder="HH:MM" /><Field label="Référence de vente papier" /><Field label="Référence de l’ordonnance" /></div><div className="mt-4 space-y-2"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Ordonnance en attente de transfert — exemple.</div><div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">En cas de panne, utiliser le carnet papier de contrôle prévu et faire vérifier les saisies différées par le promoteur.</div></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Enregistrement différé non exécuté")}>Préparer la saisie différée</Action><Action variant="light" onClick={() => demoAction("Modèle de carnet papier non généré")}>Aperçu carnet papier</Action><Action variant="light" onClick={() => go("offline")}>File de synchronisation</Action></div></Panel>}

          {screen === "pin" && <Panel title="PIN de caisse et validation" subtitle="Écran visuel seulement — aucune biométrie ni vérification réelle"><div className="mx-auto max-w-md"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-3xl">▣</div><div className="mt-4 grid gap-3"><Field label="PIN de caisse" placeholder="6 à 8 chiffres" /><Field label="Référence de la demande" /></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Validation du PIN non exécutée")}>Vérifier le PIN (aperçu)</Action><Action variant="light" onClick={() => go("demandes")}>Demandes en attente</Action></div><p className="mt-3 text-xs text-slate-500">La décision finale appartient au rôle habilité ; une demande refusée doit afficher son motif.</p></div></Panel>}

          {screen === "creances" && <div className="space-y-4"><Panel title="Créances, bordereaux et rejets" subtitle="Consultation limitée ; génération et relance non connectées"><div className="grid gap-3 sm:grid-cols-3"><Field label="Assureur" /><Field label="Période" /><Field label="Statut" /></div><div className="mt-4"><TableMock headers={["Assureur","Période","Montant","Statut","Motif / suivi"]} rows={[[ "Assureur démo","—","— FCFA","À déposer","—"],["Assureur démo","—","— FCFA","Rejeté","Motif à consulter"],["Assureur démo","—","— FCFA","Ancien","Relance à examiner"]]}/></div><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => demoAction("Aperçu du bordereau non généré")}>Générer bordereau (aperçu)</Action><Action variant="light" onClick={() => demoAction("Export PDF non connecté")}>Export PDF</Action><Action variant="light" onClick={() => demoAction("Export Excel non connecté")}>Export Excel</Action><Action variant="light" onClick={() => demoAction("Relance de créance non envoyée")}>Relancer (aperçu)</Action><Action variant="light" onClick={() => go("assurances")}>Dossiers assurance</Action></div></Panel></div>}

          {screen === "fournisseurs" && <Panel title="Fournisseurs et dettes" subtitle="Lecture de démonstration"><div className="grid gap-3 sm:grid-cols-2"><Field label="Fournisseur" /><Field label="Contact" /><Field label="Conditions" /><Field label="Solde dû" /></div><div className="mt-4"><TableMock headers={["Commande","Date","Montant","Statut","Documents"]} rows={[[ "Commande démo","—","— FCFA","En cours","Voir les pièces"]]}/></div><div className="mt-4 flex flex-wrap gap-2"><Action variant="light" onClick={() => go("commande")}>Réapprovisionnement</Action><Action variant="light" onClick={() => go("fournisseurs")}>Fournisseurs et dettes</Action><Action variant="light" onClick={() => go("reception")}>Réception</Action><Action variant="light" onClick={() => demoAction("Documents fournisseurs non connectés")}>Documents liés</Action></div></Panel>}

          {screen === "alertes" && <Panel title="Centre des alertes" subtitle="Chaque ligne propose une navigation vers l’objet concerné"><div className="space-y-3">{[["Stock bas","Stock · quantité à vérifier","stock","amber"],["Lot proche de péremption","Lot et date à examiner","lots","red"],["Réservation à échéance","Réservation à préparer","reservations","blue"],["Ordonnance en attente","Décision du professionnel habilité","ordonnances","amber"],["Demande traitée","Voir le motif et la décision","demandes","green"]].map(([a,b,target,tone])=><div key={a} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-bold">{a}</p><p className="mt-1 text-sm text-slate-500">{b}</p></div><Status tone={tone as "green"|"amber"|"red"|"blue"}>Démo</Status><Action variant="light" onClick={() => go(target as Screen)}>Ouvrir l’objet →</Action></div>)}</div><div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Les seuils sont réglés par le promoteur. Les alertes illustrées ne sont ni émises ni tracées.</div></Panel>}

          {screen === "inventaire-refus" && <Panel title="Inventaire — accès réservé" subtitle="État d’accès refusé conforme au périmètre caisse"><div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-extrabold text-red-900">Accès non disponible pour le compte caisse</p><p className="mt-1 text-sm text-red-800">Le cahier attribue l’inventaire au magasinier, avec validation des écarts par le promoteur. La caissière consulte uniquement le stock ajusté une fois validé.</p></div><div className="mt-4"><Action variant="light" onClick={() => go("stock")}>Retour à Mon stock</Action></div></Panel>}


          {screen === "connexion" && <Panel title="Connexion au compte caisse" subtitle="Écran de présentation — aucune authentification"><div className="mx-auto max-w-md"><div className="mb-4 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#ffe23d] font-black text-[#0b3d26]">N</span><div><p className="text-lg font-black">NAXA</p><p className="text-sm text-slate-500">Espace caisse pharmacie</p></div></div><div className="space-y-3"><Field label="Identifiant / e-mail" /><Field label="Mot de passe" placeholder="••••••••••" /></div><div className="mt-4 flex flex-wrap gap-2"><Action onClick={() => demoAction("Connexion non exécutée : authentification non connectée")}>Se connecter</Action><Action variant="light" onClick={() => go("mot-de-passe-oublie")}>Mot de passe oublié</Action></div><div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">Message d’erreur générique — identifiant ou mot de passe incorrect.</div><div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500"><button onClick={() => demoAction("Conditions d’utilisation non ouvertes")} className="underline">Conditions</button><button onClick={() => demoAction("Politique de confidentialité non ouverte")} className="underline">Confidentialité</button><button onClick={() => demoAction("Informations de sécurité non ouvertes")} className="underline">Sécurité</button><span>Urgences : 1510 · 119 · 1511</span></div></div></Panel>}

          {screen === "premiere-connexion" && <Panel title="Première connexion" subtitle="Choix du mot de passe provisoire — formulaire de démonstration"><div className="mx-auto max-w-md space-y-3"><div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Votre compte doit choisir un mot de passe personnel avant de continuer.</div><Field label="Mot de passe provisoire" placeholder="Mot de passe fourni" /><Field label="Nouveau mot de passe" placeholder="10 caractères minimum" /><Field label="Confirmer le nouveau mot de passe" placeholder="Répéter le mot de passe" /><div className="flex flex-wrap gap-2"><Action onClick={() => demoAction("Changement de mot de passe non exécuté")}>Enregistrer le mot de passe</Action><Action variant="light" onClick={() => go("connexion")}>Retour connexion</Action></div></div></Panel>}

          {screen === "mot-de-passe-oublie" && <Panel title="Mot de passe oublié" subtitle="Parcours e-mail / code OTP représenté sans envoi réel"><div className="mx-auto max-w-md space-y-3"><ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600"><li>Saisir l’adresse e-mail du compte.</li><li>Recevoir et saisir le code de vérification.</li><li>Choisir un nouveau mot de passe.</li></ol><Field label="Adresse e-mail" placeholder="nom@exemple.com" /><div className="flex flex-wrap gap-2"><Action onClick={() => demoAction("Envoi d’OTP non connecté")}>Envoyer le code (aperçu)</Action><Action variant="light" onClick={() => demoAction("Vérification OTP non connectée")}>Saisir / vérifier le code</Action><Action variant="light" onClick={() => go("premiere-connexion")}>Nouveau mot de passe</Action><Action variant="light" onClick={() => go("connexion")}>Retour connexion</Action></div><p className="text-xs text-slate-500">Le message réel doit rester générique pour ne pas révéler si un compte existe.</p></div></Panel>}

          {screen === "deconnexion" && <div className="grid gap-4 xl:grid-cols-2"><Panel title="Quitter l’espace caisse" subtitle="Confirmation visuelle uniquement"><div className="flex gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-2xl">↪</span><div><p className="font-bold">Vous allez quitter votre espace caisse</p><p className="mt-1 text-sm text-slate-500">En situation réelle, vérifiez la clôture de la caisse et les éléments en attente de synchronisation.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Action variant="danger" onClick={() => demoAction("Déconnexion non exécutée dans le prototype")}>Se déconnecter</Action><Action variant="light" onClick={() => go("dashboard")}>Annuler / retour accueil</Action><Action variant="light" onClick={() => go("connexion")}>Écran de connexion</Action></div></Panel><Panel title="États de message"><div className="space-y-2"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">En ligne — connexion disponible.</div><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Hors ligne — vérifier la synchronisation avant de quitter.</div><div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">Erreur — déconnexion impossible, réessayez.</div></div></Panel></div>}

          {demoDialog && <div role="dialog" aria-modal="true" aria-labelledby="demo-dialog-title" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4">
            <div className="my-4 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-xl">♧</span>
                <div className="min-w-0 flex-1">
                  <h2 id="demo-dialog-title" className="font-extrabold">Boucle de notifications — test d’architecture</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{demoDialog}</p>
                  <p className="mt-1 text-xs text-slate-500">Scénarios synthétiques uniquement : aucune notification externe, opération de caisse ou modification de données n’est exécutée.</p>
                  {OPERATIONAL_PATHS[screen] ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-sm font-bold text-emerald-950">Parcours métier raccordé : {OPERATIONAL_PATHS[screen]!.label}</p>
                      <p className="mt-1 text-xs text-emerald-800">L’action métier réelle doit être effectuée et confirmée dans cette interface, avec ses contrôles serveur et ses droits.</p>
                      <button type="button" onClick={() => window.location.assign(OPERATIONAL_PATHS[screen]!.path)} className="mt-3 min-h-11 rounded-xl bg-[#0b3d26] px-4 py-2 text-sm font-bold text-white">Ouvrir l’interface métier →</button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-bold text-red-900">Aucune opération métier raccordée à cet écran</p>
                      <p className="mt-1 text-xs text-red-800">Le clic reste un test de notification. Aucun enregistrement, changement de statut ou appel serveur n’est effectué.</p>
                    </div>
                  )}
                </div>
                <button type="button" onClick={closeDialog} aria-label="Fermer la fenêtre de notification" className="min-h-11 min-w-11 rounded-xl border border-slate-200 font-bold">×</button>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Rôle concerné
                  <select value={notificationRole} onChange={e => { setNotificationRole(e.target.value); setNotificationCursor(0); }} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3">
                    {NOTIFICATION_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">Domaine fonctionnel
                  <select value={notificationDomain} onChange={e => { setNotificationDomain(e.target.value); setNotificationCursor(0); }} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3">
                    {NOTIFICATION_DOMAINS.map(domain => <option key={domain} value={domain}>{domain}</option>)}
                  </select>
                </label>
              </div>
              {currentNotification ? <section aria-live="polite" className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Status tone={currentNotification.priority === "À traiter" ? "red" : currentNotification.priority === "Contrôle" ? "amber" : "blue"}>{currentNotification.priority}</Status>
                  <span className="text-xs font-semibold text-slate-500">Cas {currentNotification.id} / 1000 · {safeNotificationCursor + 1} sur {visibleNotificationCases.length} filtrés</span>
                </div>
                <h3 className="mt-3 font-extrabold text-slate-900">{currentNotification.state}</h3>
                <p className="mt-1 text-sm text-slate-600">{currentNotification.message}</p>
                <p className="mt-2 text-xs text-slate-500">Rôle : {currentNotification.role} · Domaine : {currentNotification.domain}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Action variant="light" onClick={() => advanceNotification(-1)}>← Précédent</Action>
                  <Action onClick={() => advanceNotification(1)}>Suivant →</Action>
                  <Action variant="light" onClick={markCurrentNotificationRead}>{currentNotification && readNotificationIds.includes(currentNotification.id) ? "Déjà marqué comme lu" : "Marquer comme lu"}</Action>
                </div>
              </section> : <Empty title="Aucun scénario" body="Changez le rôle ou le domaine pour afficher les cas correspondants." />}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">{notificationCases.length.toLocaleString("fr-FR")} scénarios générés · {readNotificationIds.length} marqués comme lus dans cette session</p>
                <Action variant="danger" onClick={closeDialog}>Fermer</Action>
              </div>
            </div>
          </div>}
          <footer className="rounded-2xl bg-[#0b3d26] p-4 text-sm text-white"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffe23d] font-black text-[#0b3d26]">N</span><div><p className="font-black">NAXA · Parcours caisse</p><p className="text-xs text-emerald-100">Prototype d’écrans non connecté</p></div></div><p className="text-xs text-emerald-100">Navigation locale seulement · aucun paiement ou enregistrement réel.</p></div></footer>
        </div>
      </div>
    </div>
  </main>;
}
