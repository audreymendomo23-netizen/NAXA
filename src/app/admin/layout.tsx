import type { ReactNode } from "react";
import Link from "next/link";
import "./admin-bento.css";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { Logo } from "@/components/Logo";
import { EspaceNaxaSwitcher } from "@/components/EspaceNaxaSwitcher";
import { supabaseServer } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  let alertes = 0;
  let afficherAlertes = false;

  if (auth.user) {
    const { data: profile } = await sb.from("profiles").select("role,actif").eq("id", auth.user.id).maybeSingle();
    afficherAlertes = profile?.role === "admin" && profile.actif !== false;
    if (afficherAlertes) {
      const [{ data: pharmacies, error: pharmaciesError }, { data: validites, error: validitesError }] = await Promise.all([
        sb.from("pharmacies").select("id,stock_updated_at,actif,visible_recherche"),
        sb.rpc("validites_promoteurs_admin"),
      ]);
      if (!pharmaciesError) {
        alertes += (pharmacies ?? []).filter((p) => !p.stock_updated_at).length;
        alertes += (pharmacies ?? []).filter((p) => p.actif === false || p.visible_recherche === false).length;
      }
      if (!validitesError) {
        alertes += ((validites ?? []) as { statut?: string; jours_restants?: number | string | null }[])
          .filter((v) => v.statut === "impaye" || Number(v.jours_restants) < 0).length;
      }
    }
  }

  return (
    <div className="admin-bento-shell">
      <aside className="admin-bento-sidebar" aria-label="Navigation de l’administration">
        <Link href="/admin" className="admin-bento-brand" aria-label="NAXA administration, accueil">
          <Logo taille={32} />
        </Link>
        <div className="admin-bento-nav-caption">ESPACE DE TRAVAIL</div>
        <AdminNavigation />
        <div className="admin-bento-sidebar-footer">
          <span className="admin-bento-status-dot" aria-hidden="true" />
          <span><strong>Console NAXA</strong><small>Interface d’administration</small></span>
        </div>
      </aside>
      <div className="admin-bento-workspace">
        <header className="admin-bento-topbar">
          <div><span className="admin-bento-eyebrow">NAXA / ADMINISTRATION</span><p>Vue d’ensemble des opérations</p></div>
          <div className="flex items-center gap-3">
            {afficherAlertes && <Link href="/admin/alertes" aria-label={alertes ? `Alertes réseau, ${alertes} signaux à examiner` : "Alertes réseau"} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 hover:bg-slate-50">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
              {alertes > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#FFE23D] px-1 text-center text-[10px] font-extrabold leading-5 text-[#0B3D26]">{alertes > 99 ? "99+" : alertes}</span>}
            </Link>}
            <EspaceNaxaSwitcher current="admin" />
          </div>
        </header>
        <div className="admin-bento-content">{children}</div>
      </div>
    </div>
  );
}
