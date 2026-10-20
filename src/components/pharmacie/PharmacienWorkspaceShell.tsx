"use client";

import type { ReactNode } from "react";
import { PharmacienWorkspaceSidebar } from "@/components/pharmacie/PharmacienWorkspaceSidebar";

type PharmacienWorkspaceShellProps = {
  children: ReactNode;
  activeTab: "dashboard" | "consultation" | "prescription" | "ordonnances" | "preparations" | "historique" | "rapports" | "profil";
  onNavigate: (section: PharmacienWorkspaceShellProps["activeTab"]) => void;
};

/**
 * Coquille visuelle partagée de l'espace Pharmacien, alignée sur l'architecture
 * CaisseWorkspaceShell : navigation responsive séparée du contenu métier.
 * Les données et les opérations restent dans les vues et RPC existantes.
 */
export function PharmacienWorkspaceShell({
  children,
  activeTab,
  onNavigate,
}: PharmacienWorkspaceShellProps) {
  return (
    <main className="min-h-screen bg-[#F4F8F5] px-3 pb-10 pt-3 sm:px-4 sm:pt-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        <PharmacienWorkspaceSidebar activeTab={activeTab} onNavigate={onNavigate} />
        <div className="min-w-0 flex-1 space-y-4">{children}</div>
      </div>
    </main>
  );
}
