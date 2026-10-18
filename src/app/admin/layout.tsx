import type { ReactNode } from "react";
import Link from "next/link";
import "./admin-bento.css";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-bento-shell">
      <aside className="admin-bento-sidebar" aria-label="Navigation de l’administration">
        <Link href="/admin" className="admin-bento-brand" aria-label="NAXA administration, accueil">
          <span className="admin-bento-brand-mark" aria-hidden="true">N</span>
          <span className="admin-bento-brand-copy"><strong>NAXA</strong><small>ESPACE ADMIN</small></span>
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
          <Link href="/" className="admin-bento-exit">Retour à NAXA <span aria-hidden="true">↗</span></Link>
        </header>
        <div className="admin-bento-content">{children}</div>
      </div>
    </div>
  );
}
