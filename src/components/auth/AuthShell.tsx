"use client";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { FondBulles } from "@/components/BullesAuthentification";
import { AuthDraftProvider } from "@/components/auth/AuthDraftContext";
function EnteteAuth() {
  const pathname=usePathname(), search=useSearchParams();
  const [nomPharmacie,setNomPharmacie]=useState("");
  const pharmacie=search.get("espace")==="pharmacie"||pathname.startsWith("/pharmacie");
  useEffect(()=>{const onName=(event:Event)=>setNomPharmacie(String((event as CustomEvent<string>).detail||""));window.addEventListener("naxa:pharmacy-name",onName);return()=>window.removeEventListener("naxa:pharmacy-name",onName)},[]);
  const titre=pharmacie?(nomPharmacie||"Espace Pharmacie"):"Espace client";
  return <header className="relative z-10 w-full max-w-lg"><div className="flex w-full items-center justify-between gap-3"><div className="logo-pastille"><Logo taille={30}/></div><p className="reveal inline-flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-naxa-green-100 bg-white/70 px-4 py-2 text-xl font-extrabold tracking-tight text-[#064B2A] shadow-sm"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#FFE33D] ring-[3px] ring-[#FFE33D]/40"/><span className="truncate">{titre}</span></p></div></header>;
}
export function AuthShell({children}:{children:ReactNode}) {
  const pathname=usePathname();
  if(pathname==="/connexion")return <AuthDraftProvider>{children}</AuthDraftProvider>;
  return <AuthDraftProvider><main className={`auth-ecran relative isolate !h-auto !min-h-[100dvh] !overflow-y-auto flex flex-col items-center overflow-x-hidden bg-[#F2FAF5] px-[30px] pb-[calc(32px+env(safe-area-inset-bottom,0px))] ${pathname==="/creation-compte"?"auth-ecran-sans-flou":""}`}><FondBulles/><div className="relative z-10 flex w-full flex-1 flex-col items-center"><div className="w-full max-w-lg shrink-0" style={{paddingTop:"calc(env(safe-area-inset-top,0px) + 12px)"}}><Suspense fallback={<header className="flex min-h-10 items-center justify-between gap-3"><div className="logo-pastille"><Logo taille={30}/></div><span aria-hidden="true" className="h-10 w-28 rounded-full bg-white/70"/></header>}><EnteteAuth/></Suspense></div><div className="auth-content relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 pt-3">{children}</div></div></main></AuthDraftProvider>;
}
