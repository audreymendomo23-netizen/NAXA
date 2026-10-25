"use client";

import { usePathname } from "next/navigation";
import { EnTeteClient } from "@/components/EnTeteClient";

function appartientAuParcoursClient(pathname: string) {
  return pathname === "/client"
    || pathname.startsWith("/client/")
    || pathname === "/panier"
    || pathname === "/scanner"
    || pathname === "/recherche"
    || pathname === "/notifications"
    || pathname.startsWith("/reservation/")
    || pathname.startsWith("/univers-reservation/");
}

export function ParcoursClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const afficherEntete = appartientAuParcoursClient(pathname);

  return (
    <>
      {afficherEntete && <EnTeteClient />}
      {afficherEntete ? (
        <div key={pathname} className="naxa-immersive-page">
          {children}
        </div>
      ) : children}
    </>
  );
}
