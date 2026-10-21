"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type CaisseSidebarProps = {
  sessionOpen?: boolean;
  creditsDue?: number;
  pharmacyName?: string;
};

const entries = [
  { href: "/pharmacie/caisse", label: "Tableau de bord", icon: "⌂", exact: true },
  { href: "/pharmacie/caisse/clients", label: "Clients et Assurances", icon: "♙", badge: "credits" as const },
  { href: "/pharmacie/caisse/historique", label: "Historique des ventes", icon: "▤" },
  { href: "/pharmacie/caisse/service", label: "Prise / fin de service", icon: "◷", badge: "session" as const },
  { href: "/pharmacie/caisse/rapports", label: "Rapports & Performances", icon: "▥" },
  { href: "/pharmacie/caisse/profil", label: "Profil", icon: "♙" },
];

export function CaisseSidebar({ sessionOpen = false, creditsDue, pharmacyName }: CaisseSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sb = useMemo(() => supabaseBrowser(), []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [creditCount, setCreditCount] = useState<number | null>(creditsDue ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (creditsDue !== undefined) {
      setCreditCount(creditsDue);
      return;
    }
    let alive = true;
    void (async () => {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await sb.from("profiles").select("pharmacie_id").eq("id", auth.user.id).maybeSingle();
      const pharmacyId = profile?.pharmacie_id;
      if (!pharmacyId) return;
      const { count, error: queryError } = await sb.from("client_credits")
        .select("id", { count: "exact", head: true })
        .eq("pharmacie_id", pharmacyId)
        .eq("actif", true)
        .gt("solde", 0);
      if (alive && !queryError && count !== null) setCreditCount(count);
    })();
    return () => { alive = false; };
  }, [sb, creditsDue]);

  async function logout() {
    if (busy) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Déconnexion bloquée hors ligne. Reconnectez le poste pour préserver la synchronisation.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: signOutError } = await sb.auth.signOut();
    setBusy(false);
    if (signOutError) {
      setError("Déconnexion impossible. Réessayez après vérification de la connexion.");
      return;
    }
    router.replace("/connexion");
  }

  const nav = (
    <>
      <div className="mb-6 flex items-center gap-3 px-3">
        <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFE23D] text-lg font-black text-[#0B3D26]">N</span>
        <div className="min-w-0">
          <p className="text-lg font-black tracking-wide">NAXA</p>
          <p className="truncate text-xs text-emerald-100">{pharmacyName || "Compte caisse"}</p>
        </div>
      </div>
      <nav aria-label="Navigation principale caisse" className="space-y-1">
        {entries.map((entry) => {
          const active = entry.exact ? pathname === entry.href : pathname === entry.href || pathname.startsWith(entry.href + "/");
          const badge = entry.badge === "credits" ? creditCount : entry.badge === "session" ? (sessionOpen ? 0 : " !") : null;
          return (
            <a key={entry.href} href={entry.href} onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${active ? "bg-[#FFE23D] text-[#0B3D26]" : "text-white hover:bg-white/10"}`}>
              <span aria-hidden="true" className="w-5 shrink-0 text-center text-lg">{entry.icon}</span>
              <span className="min-w-0 flex-1">{entry.label}</span>
              {badge !== null && badge !== 0 && (
                <span className={`min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-extrabold ${entry.badge === "session" ? "bg-[#FFE23D] text-[#0B3D26]" : "bg-white text-[#0B3D26]"}`}>
                  {badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>
      <div className="mt-auto pt-6">
        <button type="button" onClick={() => void logout()} disabled={busy}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">
          <span aria-hidden="true" className="w-5 text-center text-lg">↪</span>
          {busy ? "Déconnexion…" : "Déconnexion"}
        </button>
        {error && <p role="alert" className="mx-3 mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">{error}</p>}
        <p className="mt-4 px-3 text-xs text-emerald-100">Version {process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || "build"}</p>
      </div>
    </>
  );

  return (
    <>
      <button type="button" aria-label="Ouvrir le menu caisse" aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        className="mb-3 inline-flex items-center gap-2 rounded-xl bg-[#0B3D26] px-4 py-3 font-bold text-white lg:hidden">
        <span aria-hidden="true">☰</span> Menu caisse
      </button>
      <aside className="hidden min-h-[calc(100vh-2rem)] w-64 shrink-0 flex-col rounded-2xl bg-[#0B3D26] p-3 text-white lg:flex">
        {nav}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" role="presentation" onClick={() => setMobileOpen(false)}>
          <aside className="flex h-full w-[min(20rem,86vw)] flex-col overflow-y-auto bg-[#0B3D26] p-3 text-white shadow-2xl"
            role="dialog" aria-modal="true" aria-label="Menu caisse" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="mb-4 self-end rounded-lg px-3 py-2 text-white" onClick={() => setMobileOpen(false)}>Fermer ✕</button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
