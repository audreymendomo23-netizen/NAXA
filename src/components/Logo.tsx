"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

function destinationInitiale(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/admin";
  if (pathname.startsWith("/pharmacie") || pathname.startsWith("/pharmacien")) return "/pharmacie";
  if (pathname.startsWith("/client")) return "/client";
  return "/";
}

function estPhaseAuthentification(pathname: string): boolean {
  return [
    "/connexion",
    "/creation-compte",
    "/mot-de-passe-oublie",
    "/nouveau-mot-de-passe",
    "/verification-age",
  ].some((route) => pathname === route || pathname.startsWith(route + "/"));
}

export function Logo({ clair = true, taille = 40 }: { clair?: boolean; taille?: number }) {
  const pathname = usePathname();
  const [destination, setDestination] = useState(() => destinationInitiale(pathname));

  useEffect(() => {
    let actif = true;

    async function actualiserDestination() {
      if (estPhaseAuthentification(pathname)) {
        setDestination("/");
        return;
      }

      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!actif) return;

      if (!user) {
        setDestination("/");
        return;
      }

      const { data: profil } = await sb
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!actif) return;
      if (profil?.role === "admin") setDestination("/admin");
      else if (profil?.role === "client") setDestination("/client");
      else setDestination("/pharmacie");
    }

    void actualiserDestination();
    return () => {
      actif = false;
    };
  }, [pathname]);

  const libelle = destination === "/" ? "Accueil NAXA" : "Tableau de bord NAXA";

  return (
    <Link href={destination} aria-label={libelle} title={libelle} className="inline-flex shrink-0">
      <Image
        src={clair ? "/naxa-logo.png" : "/naxa-logo-sombre.png"}
        alt="NAXA"
        width={Math.round(taille * 3.95)}
        height={taille}
        priority
      />
    </Link>
  );
}
