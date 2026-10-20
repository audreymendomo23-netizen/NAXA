"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Section = "dashboard" | "consultation" | "prescription" | "ordonnances" | "preparations" | "profil";
type Entry = { id: Section | "dispositifs"; label: string; icon: string; href?: string };
type Props = { activeTab: Section; onNavigate: (section: Section) => void };

const entries: Entry[] = [
  { id: "dashboard", label: "Tableau de bord", icon: "⌂" },
  { id: "consultation", label: "Consultations", icon: "♡" },
  { id: "prescription", label: "Prescriptions", icon: "▤" },
  { id: "ordonnances", label: "Ordonnances", icon: "✓" },
  { id: "preparations", label: "Préparations", icon: "☷" },
  { id: "dispositifs", label: "Suivi des dispositifs Patient", icon: "⌁", href: "/suivi" },
  { id: "profil", label: "Profil", icon: "♙" },
];

export function PharmacienWorkspaceSidebar({ activeTab, onNavigate }: Props) {
  const router = useRouter();
  const sb = useMemo(() => supabaseBrowser(), []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const nav = <><div className="mb-6 flex items-center gap-3 px-3"><span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFE23D] text-lg font-black text-[#0B3D26]">N</span><div><p className="text-lg font-black tracking-wide">NAXA</p><p className="text-xs text-emerald-100">Compte Pharmacien</p></div></div><nav aria-label="Navigation principale Pharmacien" className="space-y-1">{entries.map(entry=><button key={entry.id} type="button" onClick={()=>{if(entry.href){router.push(entry.href)}else if(entry.id!=="dispositifs"){onNavigate(entry.id)}setMobileOpen(false)}} aria-current={entry.id!=="dispositifs"&&activeTab===entry.id?"page":undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${activeTab===entry.id?"bg-[#FFE23D] text-[#0B3D26]":"text-white hover:bg-white/10"}`}><span aria-hidden="true" className="w-5 shrink-0 text-center text-lg">{entry.icon}</span><span>{entry.label}</span></button>)}</nav><div className="mt-auto pt-6"><button type="button" onClick={()=>void logout()} disabled={busy} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"><span aria-hidden="true" className="w-5 text-center text-lg">↪</span>{busy?"Déconnexion…":"Déconnexion"}</button>{error&&<p role="alert" className="mx-3 mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">{error}</p>}</div></>;
  return <><button type="button" aria-label="Ouvrir le menu Pharmacien" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)} className="mb-3 inline-flex items-center gap-2 rounded-xl bg-[#0B3D26] px-4 py-3 font-bold text-white lg:hidden"><span aria-hidden="true">☰</span> Menu Pharmacien</button><aside className="hidden min-h-[calc(100vh-2rem)] w-64 shrink-0 flex-col rounded-2xl bg-[#0B3D26] p-3 text-white lg:flex">{nav}</aside>{mobileOpen&&<div className="fixed inset-0 z-50 bg-black/50 lg:hidden" role="presentation" onClick={()=>setMobileOpen(false)}><aside className="flex h-full w-[min(20rem,86vw)] flex-col overflow-y-auto bg-[#0B3D26] p-3 text-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Menu Pharmacien" onClick={event=>event.stopPropagation()}><button type="button" className="mb-4 self-end rounded-lg px-3 py-2 text-white" onClick={()=>setMobileOpen(false)}>Fermer ✕</button>{nav}</aside></div>}</>;
}
