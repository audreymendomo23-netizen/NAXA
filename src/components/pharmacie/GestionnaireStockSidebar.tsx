import Link from "next/link";
import { DeconnexionGestionnaireStock } from "@/components/pharmacie/DeconnexionGestionnaireStock";
import { EspaceNaxaSwitcher } from "@/components/EspaceNaxaSwitcher";

const entries = [
  { href: "/pharmacie/gestionnaire-stock", label: "Tableau de bord", icon: "▦" },
  { href: "/pharmacie/gestionnaire-stock/stock-logistique", label: "Stock & logistique", icon: "▤" },
  { href: "/pharmacie/gestionnaire-stock/reservations", label: "Réservations Marketplace", icon: "◷" },
  { href: "/pharmacie/gestionnaire-stock/commandes", label: "Commandes à livrer", icon: "⇢" },
  { href: "/pharmacie/gestionnaire-stock/lots-peremptions", label: "Lots & péremptions", icon: "◫" },
  { href: "/pharmacie/gestionnaire-stock/fournisseurs-receptions", label: "Fournisseurs & réceptions", icon: "⇄" },
  { href: "/pharmacie/gestionnaire-stock/inventaires", label: "Inventaires", icon: "☷" },
  { href: "/pharmacie/gestionnaire-stock/historique-rapports", label: "Historique & rapports", icon: "▥" },
  { href: "/pharmacie/gestionnaire-stock/service", label: "Prise / fin de service", icon: "◷" },
  { href: "/pharmacie/gestionnaire-stock/profil", label: "Profil", icon: "◉" },
];

export function GestionnaireStockSidebar({ active }: { active: string }) {
  return <aside className="rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-sm">
    <p className="px-3 pb-2 pt-1 text-xs font-black uppercase tracking-widest text-emerald-900">Poste de stock NAXA</p>
    <nav aria-label="Navigation gestionnaire de stock" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
      {entries.map((entry) => <Link key={entry.href} href={entry.href} aria-current={active === entry.href ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold ${active === entry.href ? "bg-[#0B3D26] text-white" : "text-slate-700 hover:bg-emerald-50"}`}>
        <span aria-hidden="true" className="w-5 text-center text-base">{entry.icon}</span><span>{entry.label}</span>
      </Link>)}
    </nav>
    <div className="mt-3"><EspaceNaxaSwitcher current="stock" /></div>
    <div className="mt-3 border-t pt-3"><DeconnexionGestionnaireStock /></div>
  </aside>;
}
