"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { EnTeteClient } from "@/components/EnTeteClient";
import { NaxaSupportWidget } from "@/components/NaxaSupportWidget";
import { supabaseBrowser } from "@/lib/supabase/client";
function appartientAuParcoursClient(pathname: string) {
  return pathname === "/client" || pathname.startsWith("/client/") || pathname === "/panier"
    || pathname === "/faq" || pathname === "/assistance" || pathname === "/scanner"
    || pathname === "/recherche" || pathname === "/notifications" || pathname === "/resultats"
    || pathname === "/gardes" || pathname.startsWith("/produit/") || pathname.startsWith("/offre/")
    || pathname === "/aide" || pathname === "/commande/nouvelle" || pathname === "/commande/bebe-maman"
    || pathname === "/achats/credit" || pathname.startsWith("/achats/credit/") || pathname === "/achats"
    || pathname.startsWith("/achats/") || pathname === "/favoris" || pathname.startsWith("/favoris/")
    || pathname === "/commandes" || pathname.startsWith("/commandes/") || pathname === "/reservations"
    || pathname.startsWith("/reservations/") || pathname.startsWith("/reservation/")
    || pathname.startsWith("/univers-reservation/") || pathname === "/parapharmacie"
    || pathname.startsWith("/parapharmacie/") || pathname === "/examens" || pathname.startsWith("/examens/")
    || pathname === "/prestations" || pathname.startsWith("/prestations/") || pathname === "/bebe-maman"
    || pathname.startsWith("/bebe-maman/") || pathname === "/suivi"
    || (pathname.startsWith("/suivi/") && !pathname.startsWith("/suivi/professionnel"));
}
function appartientAuParcoursProfessionnel(pathname: string) {
  return pathname.startsWith("/pharmacie") || pathname.startsWith("/partenaire") || pathname.startsWith("/centre-examens");
}
function bottomNavigationVisible(pathname: string) {
  return pathname === "/client" || pathname.startsWith("/client/") || pathname === "/scanner"
    || pathname === "/panier" || pathname === "/notifications" || pathname === "/resultats"
    || pathname.startsWith("/univers-reservation/") || pathname.startsWith("/reservation/");
}
export function ParcoursClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sessionReady, setSessionReady] = useState(false);
  const [clientConnecte, setClientConnecte] = useState(false);
  const [clientIdActif, setClientIdActif] = useState<string | null>(null);
  const [professionnelIdActif, setProfessionnelIdActif] = useState<string | null>(null);
  useEffect(() => {
    const supabase = supabaseBrowser();
    let actif = true;
    async function synchroniserCompte(user: { id: string } | null) {
      setClientConnecte(false); setClientIdActif(null); setProfessionnelIdActif(null);
      if (!user) return;
      const [{ data: profile, error }, { data: activeRole, error: activeRoleError }] = await Promise.all([
        supabase.from("profiles").select("role,actif").eq("id", user.id).maybeSingle(),
        supabase.rpc("naxa_business_function"),
      ]);
      if (!actif || error || activeRoleError || !profile || profile.actif !== true) return;
      if (profile.role === "client" && activeRole === "client") {
        setClientConnecte(true); setClientIdActif(user.id); return;
      }
      if (profile.role !== "admin" && activeRole && activeRole !== "admin" && activeRole !== "client") {
        setProfessionnelIdActif(user.id);
      }
    }
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!actif) return;
      void synchroniserCompte(!error ? data.user : null).finally(() => { if (actif) setSessionReady(true); });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!actif) return;
      setSessionReady(false);
      void synchroniserCompte(session?.user ?? null).finally(() => { if (actif) setSessionReady(true); });
    });
    return () => { actif = false; subscription.unsubscribe(); };
  }, []);
  const parcoursClientAuthentifie = sessionReady && clientConnecte && appartientAuParcoursClient(pathname);
  const widgetClientVisible = sessionReady && Boolean(clientIdActif) && appartientAuParcoursClient(pathname) && pathname !== "/faq";
  const widgetProfessionnelVisible = sessionReady && Boolean(professionnelIdActif) && appartientAuParcoursProfessionnel(pathname);
  const widgetAccountId = widgetClientVisible ? clientIdActif : widgetProfessionnelVisible ? professionnelIdActif : null;
  return <>
    {parcoursClientAuthentifie && <EnTeteClient />}
    {parcoursClientAuthentifie ? <div key={pathname} className="naxa-immersive-page naxa-immersive-scroll" data-naxa-parcours="client-authentifie">{children}</div> : children}
    {widgetAccountId && <NaxaSupportWidget accountId={widgetAccountId} hasBottomNav={widgetClientVisible && bottomNavigationVisible(pathname)} />}
  </>;
}
