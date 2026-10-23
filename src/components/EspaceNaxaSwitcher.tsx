"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Space = "client" | "pharmacie" | "promoteur" | "caisse" | "stock" | "pharmacien" | "admin";
type Props = { current: Space };
type Profile = {
  role: string | null;
  fonction_interne: string | null;
  actif: boolean | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  age_verified: boolean | null;
  consent_accepted_at: string | null;
};

const SPACE_DETAILS: Record<Space, { label: string; href: string }> = {
  client: { label: "Espace client", href: "/client" },
  pharmacie: { label: "Espace pharmacie", href: "/pharmacie" },
  promoteur: { label: "Espace Promoteur", href: "/pharmacie/promoteur" },
  caisse: { label: "Poste Caisse", href: "/pharmacie/caisse" },
  stock: { label: "Poste Gestionnaire de stock", href: "/pharmacie/gestionnaire-stock" },
  pharmacien: { label: "Poste Pharmacien", href: "/pharmacie/pharmacien" },
  admin: { label: "Espace Admin", href: "/admin" },
};

export function EspaceNaxaSwitcher({ current }: Props) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const sb = supabaseBrowser();
        const { data: auth } = await sb.auth.getUser();
        if (!auth.user) return;
        const { data, error } = await sb.from("profiles")
          .select("role,fonction_interne,actif,username,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (!alive || error || !data) return;
        const profile = data as Profile;
        const allowed: Space[] = [];
        const hasClientIdentity = Boolean(
          profile.username && profile.first_name && profile.last_name && profile.phone
          && profile.date_of_birth && profile.age_verified === true && profile.consent_accepted_at,
        );
        if (hasClientIdentity) allowed.push("client");
        if (profile.actif === true) {
          if (profile.role === "admin") allowed.push("admin");
          if (profile.role === "promoteur") allowed.push("promoteur");
          if (profile.role === "pharmacie") allowed.push("pharmacie");
          if (profile.role === "caisse" || profile.fonction_interne === "caisse") allowed.push("caisse");
          if (profile.fonction_interne === "gestionnaire_stock") allowed.push("stock");
          if (profile.fonction_interne === "pharmacien") allowed.push("pharmacien");
          if (["responsable", "magasinier", "comptable"].includes(profile.fonction_interne ?? "")) allowed.push("pharmacie");
        }
        if (alive) setSpaces([...new Set(allowed)]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const available = spaces.filter((space) => space !== current);
  if (loading || available.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-800/20 bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
      >
        <span aria-hidden="true">↔</span>
        Changer d’espace
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <nav aria-label="Espaces accessibles" role="menu" className="absolute left-0 top-full z-50 mt-2 min-w-60 rounded-xl border border-emerald-900/15 bg-white p-2 text-emerald-950 shadow-xl">
          {available.map((space) => (
            <Link
              key={space}
              role="menuitem"
              href={SPACE_DETAILS[space].href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 text-sm font-semibold hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800"
            >
              {SPACE_DETAILS[space].label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
