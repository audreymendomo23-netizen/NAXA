"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = { current: "client" | "pharmacie" };
const PROFESSIONAL_ROLES = new Set(["pharmacie", "promoteur", "caisse"]);

export function EspaceNaxaSwitcher({ current }: Props) {
  const [target, setTarget] = useState<{ href: string; label: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const sb = supabaseBrowser();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return;
      const { data: profile, error } = await sb.from("profiles")
        .select("role,actif,username,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!alive || error || !profile) return;

      const hasClientIdentity = Boolean(
        profile.username && profile.first_name && profile.last_name && profile.phone
        && profile.date_of_birth && profile.age_verified === true && profile.consent_accepted_at,
      );
      if (current === "pharmacie" && hasClientIdentity) {
        setTarget({ href: "/client", label: "Espace client" });
      } else if (current === "client" && profile.actif === true && PROFESSIONAL_ROLES.has(profile.role)) {
        setTarget({
          href: profile.role === "promoteur" ? "/pharmacie/promoteur" : "/pharmacie",
          label: "Espace pharmacie",
        });
      }
    })();
    return () => { alive = false; };
  }, [current]);

  if (!target) return null;
  return (
    <Link href={target.href}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-800/20 bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
      <span aria-hidden="true">↔</span>
      {target.label}
    </Link>
  );
}
