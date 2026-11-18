"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { EnTeteClient } from "@/components/EnTeteClient";
import { NaxaSupportWidget } from "@/components/NaxaSupportWidget";
import { supabaseBrowser } from "@/lib/supabase/client";

function appartientAuParcoursClient(pathname: string) {
  return pathname === "/client"
    || pathname.startsWith("/client/")
    || pathname === "/panier"
    || pathname === "/faq"
    || pathname === "/assistance"
    || pathname === "/scanner"
    || pathname === "/recherche"
    || pathname === "/notifications"
    || pathname === "/resultats"
    || pathname === "/gardes"
    || pathname.startsWith("/produit/")
    || pathname.startsWith("/offre/")
    || pathname === "/aide"
    || pathname === "/commande/nouvelle"
    || pathname === "/commande/bebe-maman"
    || pathname === "/achats/credit"
    || pathname.startsWith("/achats/credit/")
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
    || (pathname.startsWith("/suivi/") && !pathname.startsWith("/suivi/professionnel"));
}

function bottomNavigationVisible(pathname: string) {
  return pathname === "/client"
    || pathname.startsWith("/client/")
    || pathname === "/scanner"
    || pathname === "/panier"
    || pathname === "/notifications"
    || pathname === "/resultats"
    || pathname.startsWith("/univers-reservation/")
    || pathname.startsWith("/reservation/");
}

export function ParcoursClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sessionReady, setSessionReady] = useState(false);
  const [clientConnecte, setClientConnecte] = useState(false);
  const [clientIdActif, setClientIdActif] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let actif = true;

    async function synchroniserClient(user: { id: string } | null) {
      setClientConnecte(Boolean(user));
      setClientIdActif(null);
      if (!user) return;

      const [{ data: profile, error }, { data: activeRole, error: activeRoleError }] = await Promise.all([
        supabase.from("profiles").select("role,actif").eq("id", user.id).maybeSingle(),
        supabase.rpc("naxa_business_function"),
      ]);

      if (!actif) return;
      if (!error && !activeRoleError && profile?.role === "client"
        && profile.actif === true && activeRole === "client") {
        setClientIdActif(user.id);
      }
    }

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!actif) return;
      void synchroniserClient(!error ? data.user : null).finally(() => {
        if (actif) setSessionReady(true);
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!actif) return;
      void synchroniserClient(session?.user ?? null).finally(() => {
        if (actif) setSessionReady(true);
      });
    });

    return () => {
      actif = false;
      subscription.unsubscribe();
    };
  }, []);

  const parcoursClientAuthentifie = sessionReady
    && clientConnecte
    && appartientAuParcoursClient(pathname);

  const widgetVisible = sessionReady
    && Boolean(clientIdActif)
    && appartientAuParcoursClient(pathname)
    && pathname !== "/faq";

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
      {widgetVisible && clientIdActif && (
        <NaxaSupportWidget
          clientId={clientIdActif}
          hasBottomNav={bottomNavigationVisible(pathname)}
        />
      )}
    </>
  );
}
