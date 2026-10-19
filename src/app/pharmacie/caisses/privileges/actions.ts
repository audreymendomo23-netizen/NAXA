"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function verifierCible(formData: FormData, action: "ASSIGN_PRIVILEGE" | "REVOKE_PRIVILEGE") {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/caisses/privileges");

  const { data: profile } = await sb.from("profiles").select("id,role,actif").eq("id", auth.user.id).single();
  if (profile?.role !== "promoteur") redirect("/pharmacie");
  if (profile.actif !== true) redirect("/pharmacie/promoteur");

  const caisseId = value(formData, "caisse_id");
  const pharmacieId = value(formData, "pharmacie_id");
  const privilegeCode = value(formData, "privilege_code");
  if (!uuid.test(caisseId) || !uuid.test(pharmacieId) || !/^[A-Z][A-Z0-9_]{1,79}$/.test(privilegeCode)) {
    redirect("/pharmacie/caisses/privileges?erreur=validation");
  }

  const [{ data: link, error: linkError }, { data: pharmacy, error: pharmacyError }, { data: caisse, error: caisseError }] = await Promise.all([
    sb.from("promoteur_pharmacies").select("pharmacie_id").eq("promoteur_id", auth.user.id).eq("pharmacie_id", pharmacieId).eq("actif", true).maybeSingle(),
    sb.from("pharmacies").select("id,actif,visible_recherche").eq("id", pharmacieId).maybeSingle(),
    sb.from("profiles").select("id,role,actif,pharmacie_id,parent_profile_id,niveau_interne").eq("id", caisseId).eq("parent_profile_id", auth.user.id).eq("role", "caisse").eq("actif", true).eq("pharmacie_id", pharmacieId).maybeSingle(),
  ]);
  if (linkError || pharmacyError || caisseError || !link || !pharmacy || pharmacy.actif !== true || pharmacy.visible_recherche !== true || !caisse) {
    redirect("/pharmacie/caisses/privileges?erreur=cible");
  }

  const { data: allowed, error: allowedError } = await sb.rpc("naxa_can", {
    p_privilege: action,
    p_pharmacie: pharmacieId,
    p_target: caisseId,
  });
  if (allowedError || allowed !== true) redirect("/pharmacie/caisses/privileges?erreur=autorisation");

  return { sb, caisseId, pharmacieId, privilegeCode };
}

export async function attribuerPrivilegeCaisse(formData: FormData) {
  const { sb, caisseId, pharmacieId, privilegeCode } = await verifierCible(formData, "ASSIGN_PRIVILEGE");
  const { error } = await sb.rpc("naxa_grant_privilege", {
    p_target: caisseId,
    p_privilege: privilegeCode,
    p_pharmacie: pharmacieId,
    p_scope: "POSTE_CAISSE",
  });
  redirect(error ? "/pharmacie/caisses/privileges?erreur=autorisation" : "/pharmacie/caisses/privileges?ok=attribution");
}

export async function retirerPrivilegeCaisse(formData: FormData) {
  const { sb, caisseId, pharmacieId, privilegeCode } = await verifierCible(formData, "REVOKE_PRIVILEGE");
  const { error } = await sb.rpc("naxa_revoke_privilege", {
    p_target: caisseId,
    p_privilege: privilegeCode,
    p_pharmacie: pharmacieId,
    p_scope: "POSTE_CAISSE",
  });
  redirect(error ? "/pharmacie/caisses/privileges?erreur=autorisation" : "/pharmacie/caisses/privileges?ok=retrait");
}
