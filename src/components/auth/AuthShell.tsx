"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { FondBulles } from "@/components/BullesAuthentification";
import { AuthDraftProvider } from "@/components/auth/AuthDraftContext";

function EnteteAuth() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [nomPharmacie, setNomPharmacie] = useState("");
  const pharmacie = search.get("espace") === "pharmacie" || pathname.startsWith("/pharmacie");
  const sansBadge = pathname === "/creation-compte";
  useEffect(() => {
    const onName = (event: Event) => setNomPharmacie(String((event as CustomEvent<string>).detail || ""));
    window.addEventListener("naxa:pharmacy-name", onName);
    return () => window.removeEventListener("naxa:pharmacy-name", onName);
  }, []);
  if (sansBadge) return <header className="relative z-10 w-full max-w-lg"><Logo taille={32}/></header>;
  const titre = pharmacie ? (nomPharmacie || "Espace Pharmacie") : "Espace client";
  return <header className="relative z-10 w-full max-w-lg"><div className="flex w-full items-center justify-between gap-3"><Logo taille={30}/><span className="inline-flex min-w-0 max-w-[65vw] items-center gap-2 rounded-full border border-[#D8E9DE] bg-white/80 px-4 py-2 text-base font-extrabold text-[#064B2A] shadow-sm sm:text-xl">{pharmacie && nomPharmacie ? <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="#064B2A" strokeWidth="1.8" aria-hidden="true"><path d="M3 21V7l9-4 9 4v14M9 21v-6h6v6M7 10h2M15 10h2"/></svg> : <span className="h-2 w-2 shrink-0 rounded-full bg-[#FFE33D]"/>}<span key={titre} className="truncate auth-badge-text">{titre}</span></span></div></header>;
}
export function AuthShell({children}:{children:ReactNode}) {
 return <AuthDraftProvider><main className="auth-ecran relative isolate !h-auto !min-h-[100dvh] !overflow-y-auto flex flex-col items-center overflow-x-hidden bg-[#F2FAF5] px-5 pt-3 pb-[calc(32px+env(safe-area-inset-bottom,0px))]"><FondBulles/><div className="relative z-10 flex w-full flex-1 flex-col items-center"><div className="w-full max-w-lg"><EnteteAuth/></div><div className="auth-content relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 pt-2">{children}</div></div></main></AuthDraftProvider>;
}
