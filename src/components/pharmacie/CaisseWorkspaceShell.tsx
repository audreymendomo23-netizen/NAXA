"use client";

import type { ReactNode } from "react";
import { CaisseSidebar } from "@/components/pharmacie/CaisseSidebar";

type CaisseWorkspaceShellProps = {
  children: ReactNode;
  sessionOpen?: boolean;
  creditsDue?: number;
  pharmacyName?: string;
};

/**
 * Shared visual shell for the cashier workspace.
 * It only owns layout/navigation chrome; all business state and actions stay
 * in the operational pages and existing Supabase/RPC workflows.
 */
export function CaisseWorkspaceShell({
  children,
  sessionOpen = false,
  creditsDue,
  pharmacyName,
}: CaisseWorkspaceShellProps) {
  return (
    <main className="min-h-screen bg-[#F4F8F5] px-3 pb-10 pt-3 sm:px-4 sm:pt-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        <CaisseSidebar
          sessionOpen={sessionOpen}
          creditsDue={creditsDue}
          pharmacyName={pharmacyName}
        />
        <div className="min-w-0 flex-1 space-y-4">{children}</div>
      </div>
    </main>
  );
}
