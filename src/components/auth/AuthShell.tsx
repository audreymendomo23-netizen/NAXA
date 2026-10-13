"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { FondBulles } from "@/components/auth/FondBulles";
import { useAuthFlow } from "@/components/auth/AuthFlowContext";

function BadgeEspace() {
  const search = useSearchParams();
  const { pharmacyName } = useAuthFlow();
  const pharmacie = search.get("espace") === "pharmacie";
  const etapeIdentifiants = search.get("etape") === "identifiants";
  const titre = pharmacie ? (etapeIdentifiants && pharmacyName ? pharmacyName : "Espace pharmacie") : "Espace client";
  return <span className="reveal inline-flex min-w-0 max-w-[65vw] items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-naxa-green-100 bg-white/70 px-4 py-2 text-base font-extrabold tracking-tight text-[#064B2A] shadow-sm sm:text-xl">
    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#FFE33D] ring-[3px] ring-[#FFE33D]/40" />
    <span key={titre} className="truncate auth-badge-text">{titre}</span>
  </span>;
}

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const signup = pathname === "/creation-compte";
  const forgot = pathname === "/mot-de-passe-oublie";
  const reset = pathname === "/nouveau-mot-de-passe";
  const maxWidth = signup ? "max-w-[560px]" : forgot ? "max-w-[420px]" : reset ? "max-w-[420px]" : "max-w-[360px]";
  const align = signup || forgot || reset ? "items-start" : "items-center";
  return <main className="auth-ecran relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-naxa-green-900 px-6 !h-auto !min-h-[100dvh] !overflow-y-auto" style={{ backgroundColor: "#F2FAF5" }}>
    <FondBulles />
    <header className="relative z-10 w-full shrink-0 pt-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
      <div className="flex w-full items-center justify-between gap-3">
        <div className="logo-pastille reveal"><Logo taille={30} /></div>
        <Suspense fallback={<span aria-hidden="true" className="h-10 w-32 rounded-full border border-naxa-green-100 bg-white/70" />}><BadgeEspace /></Suspense>
      </div>
    </header>
    <div className={`relative z-10 flex w-full flex-1 justify-center py-5 sm:py-8 ${align}`}>
      <div className={`w-full ${maxWidth} ${!signup && !forgot && !reset ? "mt-[-60px]" : ""}`}>
        {children}
      </div>
    </div>
  </main>;
}
