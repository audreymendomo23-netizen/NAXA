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
    || pathname === "/achats"
    || pathname.startsWith("/achats/")
    || pathname === "/favoris"
    || pathname.startsWith("/favoris/")
    || pathname === "/commandes"
    || pathname.startsWith("/commandes/")
    || pathname === "/reservations"
    || pathname.startsWith("/reservations/")
    || pathname.startsWith("/reservation/")
    || pathname.startsWith("/univers-reservation/");
}

export function ParcoursClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const afficherEntete = appartientAuParcoursClient(pathname);
  // L'accueil public possède déjà son propre header ; on lui applique
  // l'expérience immersive sans superposer l'en-tête de l'espace client.
  const accueilPublic = pathname === "/";
  const parcoursImmersif = afficherEntete || accueilPublic;

  return (
    <>
      {afficherEntete && <EnTeteClient />}
      {parcoursImmersif ? (
        <div
          key={pathname}
          className="naxa-immersive-page naxa-immersive-scroll"
          data-naxa-parcours={accueilPublic ? "accueil" : "client"}
        >
          {children}
        </div>
      ) : children}
    </>
  );
}
