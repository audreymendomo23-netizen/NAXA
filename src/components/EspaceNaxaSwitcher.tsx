"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Space = "client" | "pharmacie" | "promoteur" | "caisse" | "responsable" | "stock" | "pharmacien" | "comptable" | "admin";
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
  pharmacie_id: string | null;
};
type SpaceChoice = { key: string; space: Space; roleCode: string; pharmacyId: string | null; pharmacyName: string | null };

const SPACE_DETAILS: Record<Space, { label: string; href: string }> = {
  client: { label: "Espace client", href: "/client" },
  pharmacie: { label: "Espace pharmacie", href: "/pharmacie?vue=operation" },
  promoteur: { label: "Espace Promoteur", href: "/pharmacie/promoteur" },
  caisse: { label: "Poste Caisse", href: "/pharmacie/caisse" },
  responsable: { label: "Espace Responsable", href: "/pharmacie?vue=operation" },
  stock: { label: "Poste Gestionnaire de stock", href: "/pharmacie/gestionnaire-stock" },
  pharmacien: { label: "Poste Pharmacien", href: "/pharmacie/pharmacien" },
  comptable: { label: "Espace Comptable", href: "/pharmacie/comptable" },
  admin: { label: "Espace Admin", href: "/admin" },
};

function spaceForRole(roleCode: string): Space | null {
  switch (roleCode) {
    case "client": return "client";
    case "pharmacie": return "pharmacie";
    case "promoteur": return "promoteur";
    case "caisse": return "caisse";
    case "responsable": return "responsable";
    case "gestionnaire_stock":
    case "magasinier": return "stock";
    case "pharmacien": return "pharmacien";
    case "comptable": return "comptable";
    case "admin": return "admin";
    // Le rôle Livreur existe dans le catalogue mais son espace opérationnel n'est
    // pas encore livré ; ne pas afficher un lien qui aboutirait à une page absente.
    default: return null;
  }
}

export function EspaceNaxaSwitcher({ current }: Props) {
  const [spaces, setSpaces] = useState<SpaceChoice[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const sb = supabaseBrowser();
        const { data: auth } = await sb.auth.getUser();
        if (!auth.user) return;

        const { data, error } = await sb.from("profiles")
          .select("role,fonction_interne,actif,username,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at,pharmacie_id")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (!alive || error || !data) return;

        const profile = data as Profile;
        const choices = new Map<string, SpaceChoice>();
        const add = (roleCode: string, pharmacyId: string | null, pharmacyName: string | null = null) => {
          const space = spaceForRole(roleCode);
          if (!space) return;
          const key = `${roleCode}:${pharmacyId ?? "global"}`;
          choices.set(key, { key, space, roleCode, pharmacyId, pharmacyName });
        };

        if (profile.actif === true) {
          if (profile.role === "admin") add("admin", null);
          if (profile.role === "promoteur") add("promoteur", null);
          if (profile.role === "pharmacie" && profile.pharmacie_id) add("pharmacie", profile.pharmacie_id);
          if (profile.role === "caisse" && profile.pharmacie_id) add("caisse", profile.pharmacie_id);
          const hasClientIdentity = Boolean(
            profile.role === "client" && profile.username && profile.first_name && profile.last_name
            && profile.phone && profile.date_of_birth && profile.age_verified === true && profile.consent_accepted_at,
          );
          if (hasClientIdentity) add("client", null);

          const { data: assignments, error: assignmentsError } = await sb.from("naxa_professional_assignments")
            .select("role_code,fonction,pharmacie_id,commence_at,expire_at,statut,pharmacies(nom)")
            .eq("profile_id", auth.user.id)
            .eq("statut", "active");
          if (!assignmentsError) {
            const now = Date.now();
            for (const assignment of assignments ?? []) {
              if (new Date(assignment.commence_at).getTime() > now) continue;
              if (assignment.expire_at && new Date(assignment.expire_at).getTime() <= now) continue;
              const roleCode = String(assignment.role_code ?? assignment.fonction ?? "");
              const pharmacyId = String(assignment.pharmacie_id ?? "");
              if (!roleCode || !pharmacyId) continue;
              const relation = assignment.pharmacies as { nom?: string } | { nom?: string }[] | null;
              const pharmacyName = Array.isArray(relation) ? relation[0]?.nom ?? null : relation?.nom ?? null;
              add(roleCode, pharmacyId, pharmacyName);
            }
          }
        }

        if (alive) setSpaces([...choices.values()]);
      } catch {
        // Le menu est masqué si le profil ou les affectations ne peuvent être lus.
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const available = spaces.filter((choice) => choice.space !== current);
  if (loading || available.length === 0) return null;

  async function ouvrirEspace(choice: SpaceChoice) {
    setErrorMessage("");
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("naxa_select_active_role", {
      p_role_code: choice.roleCode,
      p_pharmacie_id: choice.pharmacyId,
    });
    if (error) {
      setErrorMessage("Impossible d’activer ce poste. Vérifiez que l’affectation est toujours valide.");
      return;
    }
    const base = SPACE_DETAILS[choice.space].href;
    const href = choice.pharmacyId && (choice.space === "pharmacie" || choice.space === "responsable")
      ? `${base}&pharmacie=${encodeURIComponent(choice.pharmacyId)}`
      : base;
    window.location.assign(href);
  }

  return (
    <div className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-800/20 bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
        <span aria-hidden="true">↔</span> {current === "admin" ? "Retour à NAXA" : "Changer d’espace"} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && <nav aria-label="Espaces accessibles" role="menu" className="absolute left-0 top-full z-50 mt-2 min-w-60 rounded-xl border border-emerald-900/15 bg-white p-2 text-emerald-950 shadow-xl">
        {available.map((choice) => (
          <button key={choice.key} type="button" role="menuitem" onClick={() => void ouvrirEspace(choice)}
            className="block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800">
            {SPACE_DETAILS[choice.space].label}{choice.pharmacyName ? ` · ${choice.pharmacyName}` : ""}
          </button>
        ))}
        {errorMessage && <p role="alert" className="px-3 py-2 text-xs text-red-700">{errorMessage}</p>}
      </nav>}
    </div>
  );
}
