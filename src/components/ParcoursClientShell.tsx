"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { EnTeteClient } from "@/components/EnTeteClient";
import { supabaseBrowser } from "@/lib/supabase/client";

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
    || pathname.startsWith("/univers-reservation/")
    || pathname === "/parapharmacie"
    || pathname.startsWith("/parapharmacie/")
    || pathname === "/examens"
    || pathname.startsWith("/examens/")
    || pathname === "/prestations"
    || pathname.startsWith("/prestations/")
    || pathname === "/bebe-maman"
    || pathname.startsWith("/bebe-maman/")
    || pathname === "/suivi"
    || pathname.startsWith("/suivi/") && !pathname.startsWith("/suivi/professionnel");
}

export function ParcoursClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sessionReady, setSessionReady] = useState(false);
  const [clientConnecte, setClientConnecte] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let actif = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!actif) return;
      setClientConnecte(!error && Boolean(data.session?.user));
      setSessionReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!actif) return;
      setClientConnecte(Boolean(session?.user));
      setSessionReady(true);
    });

    return () => {
      actif = false;
      subscription.unsubscribe();
    };
  }, []);

  // L'accueil public et les routes d'authentification restent hors du parcours immersif.
  // L'effet ne s'active que sur les routes client listées et après confirmation d'une session.
  const parcoursClientAuthentifie = sessionReady
    && clientConnecte
    && appartientAuParcoursClient(pathname);

  return (
    <>
      {parcoursClientAuthentifie && <EnTeteClient />}
      {parcoursClientAuthentifie ? (
        <div
          key={pathname}
          className="naxa-immersive-page naxa-immersive-scroll"
          data-naxa-parcours="client-authentifie"
        >
          {children}
        </div>
      ) : children}
    </>
  );
}
