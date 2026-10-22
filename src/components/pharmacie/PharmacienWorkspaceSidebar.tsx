"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { EspaceNaxaSwitcher } from "@/components/EspaceNaxaSwitcher";

type Section = "dashboard" | "consultation" | "prescription" | "ordonnances" | "preparations" | "dispositifs" | "historique" | "rapports" | "profil";
type Leaf = { id: Section; label: string; icon: string; href: string };
type Group = { id: string; label: string; icon: string; children: Leaf[] };
type Props = { activeTab: Section; onNavigate: (section: Section) => void };

const home: Leaf = { id: "dashboard", label: "Tableau de bord", icon: "⌂", href: "/pharmacie/pharmacien" };
const groups: Group[] = [
  { id: "activite", label: "Activité pharmaceutique", icon: "♡", children: [
    { id: "consultation", label: "Consultations", icon: "♡", href: "/pharmacie/pharmacien/consultation" },
    { id: "preparations", label: "Préparations", icon: "☷", href: "/pharmacie/pharmacien/preparations" },
  ]},
  { id: "ordonnances", label: "Prescriptions et ordonnances", icon: "▤", children: [
    { id: "prescription", label: "Prescriptions", icon: "▤", href: "/pharmacie/pharmacien/prescription" },
    { id: "ordonnances", label: "Ordonnances", icon: "✓", href: "/pharmacie/pharmacien/ordonnances" },
  ]},
  { id: "suivi", label: "Suivi des patients", icon: "⌁", children: [
    { id: "dispositifs", label: "Mesures partagées et consenties", icon: "⌁", href: "/pharmacie/pharmacien/suivi-patients" },
  ]},
  { id: "historique-rapports", label: "Historique et rapports", icon: "◷", children: [
    { id: "historique", label: "Historique", icon: "◷", href: "/pharmacie/pharmacien/historique" },
    { id: "rapports", label: "Rapports et performances", icon: "▥", href: "/pharmacie/pharmacien/rapports" },
  ]},
];
const direct: Leaf[] = [
  { id: "profil", label: "Profil", icon: "♙", href: "/pharmacie/pharmacien/profil" },
];

export function PharmacienWorkspaceSidebar({ activeTab, onNavigate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sb = useMemo(() => supabaseBrowser(), []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    activite: ["consultation", "preparations"].includes(activeTab),
    ordonnances: ["prescription", "ordonnances"].includes(activeTab),
    suivi: activeTab === "dispositifs",
    "historique-rapports": ["historique", "rapports"].includes(activeTab),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function navigate(item: Leaf) {
    if (item.id !== "dispositifs") onNavigate(item.id);
    router.push(item.href);
    setMobileOpen(false);
  }
  async function logout() {
    if (busy) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Déconnexion bloquée hors ligne. Reconnectez le poste avant de réessayer.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: signOutError } = await sb.auth.signOut();
    setBusy(false);
    if (signOutError) { setError("Déconnexion impossible. Réessayez après vérification de la connexion."); return; }
    router.replace("/connexion");
  }

  const itemButton = (item: Leaf) => {
    const active = pathname === item.href || (item.id === "dashboard" && pathname === "/pharmacie/pharmacien");
    return <button key={item.id} type="button" onClick={() => navigate(item)} aria-current={active ? "page" : undefined}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${active ? "bg-[#FFE23D] text-[#0B3D26]" : "text-white hover:bg-white/10"}`}>
      <span aria-hidden="true" className="w-5 shrink-0 text-center text-lg">{item.icon}</span><span className="min-w-0">{item.label}</span>
    </button>;
  };

  const nav = <><div className="mb-6 flex items-center gap-3 px-3"><span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFE23D] text-lg font-black text-[#0B3D26]">N</span><div><p className="text-lg font-black tracking-wide">NAXA</p><p className="text-xs text-emerald-100">Compte Pharmacien</p></div></div>
    <div className="mb-4 px-3"><EspaceNaxaSwitcher current="pharmacie" /></div>
    <nav aria-label="Navigation principale Pharmacien" className="space-y-2">
      {itemButton(home)}
      {groups.map(group => {
        const activeChild = group.children.some(child => pathname === child.href || (child.id === "dispositifs" && pathname.startsWith("/pharmacie/pharmacien/suivi-patients")));
        const expanded = openGroups[group.id] ?? activeChild;
        return <section key={group.id} className="rounded-xl">
          <button type="button" aria-expanded={expanded} onClick={() => setOpenGroups(current => ({ ...current, [group.id]: !expanded }))}
            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold ${activeChild ? "bg-white/10 text-[#FFE23D]" : "text-white hover:bg-white/10"}`}>
            <span aria-hidden="true" className="w-5 shrink-0 text-center text-lg">{group.icon}</span><span className="min-w-0 flex-1">{group.label}</span><span aria-hidden="true">{expanded ? "−" : "+"}</span>
          </button>
          {expanded && <div className="ml-3 mt-1 space-y-1 border-l border-white/20 pl-2">{group.children.map(itemButton)}</div>}
        </section>;
      })}
      <a href="/pharmacie/pharmacien/service" onClick={() => setMobileOpen(false)} aria-current={pathname === "/pharmacie/pharmacien/service" ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${pathname === "/pharmacie/pharmacien/service" ? "bg-[#FFE23D] text-[#0B3D26]" : "text-white hover:bg-white/10"}`}><span aria-hidden="true" className="w-5 text-center text-lg">◷</span><span>Prise / fin de service</span></a>
      {direct.map(itemButton)}
    </nav>
    <div className="mt-auto pt-6"><button type="button" onClick={() => void logout()} disabled={busy} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"><span aria-hidden="true" className="w-5 text-center text-lg">↪</span>{busy ? "Déconnexion…" : "Déconnexion"}</button>{error && <p role="alert" className="mx-3 mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">{error}</p>}</div></>;

  return <><button type="button" aria-label="Ouvrir le menu Pharmacien" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="mb-3 inline-flex items-center gap-2 rounded-xl bg-[#0B3D26] px-4 py-3 font-bold text-white lg:hidden"><span aria-hidden="true">☰</span> Menu Pharmacien</button>
    <aside className="hidden min-h-[calc(100vh-2rem)] w-72 shrink-0 flex-col rounded-2xl bg-[#0B3D26] p-3 text-white lg:flex">{nav}</aside>
    {mobileOpen && <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" role="presentation" onClick={() => setMobileOpen(false)}><aside className="flex h-full w-[min(22rem,90vw)] flex-col overflow-y-auto bg-[#0B3D26] p-3 text-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Menu Pharmacien" onClick={event => event.stopPropagation()}><button type="button" className="mb-4 self-end rounded-lg px-3 py-2 text-white" onClick={() => setMobileOpen(false)}>Fermer ✕</button>{nav}</aside></div>}
  </>;
}
