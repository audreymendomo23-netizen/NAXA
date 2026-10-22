"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";

async function exigerPromoteur() {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/connexion?retour=/pharmacie/caisses");
  const { data: p } = await sb
    .from("profiles")
    .select("id,role,actif")
    .eq("id", u.user.id)
    .single();
  if (p?.role !== "promoteur") redirect("/");
  if (p.actif !== true) redirect("/pharmacie/promoteur");
  return { userId: u.user.id, sb };
}

const value = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function creerCaisse(formData: FormData) {
  const { userId, sb } = await exigerPromoteur();
  const pharmacieId = value(formData, "pharmacie_id");
  const username = value(formData, "username").toLowerCase();

  if (!pharmacieId || !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
    redirect("/pharmacie/caisses?erreur=validation");
  }

  const { data: lien, error: lienError } = await sb
    .from("promoteur_pharmacies")
    .select("pharmacie_id")
    .eq("promoteur_id", userId)
    .eq("pharmacie_id", pharmacieId)
    .eq("actif", true)
    .maybeSingle();
  if (lienError || !lien) redirect("/pharmacie/caisses?erreur=perimetre");

  const { data: autorise, error: authError } = await sb.rpc("naxa_can", {
    p_privilege: "CREATE_CAISSE",
    p_pharmacie: pharmacieId,
    p_target: null,
  });
  if (authError || autorise !== true) redirect("/pharmacie/caisses?erreur=autorisation");

  const db = supabaseAdmin();
  const { data: matches, error: lookupError } = await db
    .from("profiles")
    .select("id,username,role,actif,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
    .ilike("username", username)
    .limit(2);
  if (lookupError) redirect("/pharmacie/caisses?erreur=lookup");
  if (!matches || matches.length !== 1) redirect("/pharmacie/caisses?erreur=compte_introuvable");

  const target = matches[0];
  if (target.role !== "client" || target.actif !== true || !target.first_name || !target.last_name
    || !target.phone || !target.date_of_birth || target.age_verified !== true || !target.consent_accepted_at) {
    redirect("/pharmacie/caisses?erreur=compte_non_eligible");
  }

  const { data: authData, error: authLookupError } = await db.auth.admin.getUserById(target.id);
  if (authLookupError || !authData.user
    || !isFinalizedNaxaProfile({ id: target.id, username: target.username ?? "" }, authData.user)) {
    redirect("/pharmacie/caisses?erreur=compte_non_eligible");
  }

  const { data: original, error: originalError } = await db.from("profiles")
    .select("role,fonction_interne,niveau_interne,niveau_hierarchique,pharmacie_id,parent_profile_id,architecture_code,actif")
    .eq("id", target.id)
    .single();
  if (originalError || !original) redirect("/pharmacie/caisses?erreur=profil");

  const { error: targetError } = await db.from("profiles").update({
    role: "caisse",
    fonction_interne: "caisse",
    niveau_interne: 3,
    niveau_hierarchique: 3,
    pharmacie_id: null,
    parent_profile_id: null,
    architecture_code: null,
    actif: false,
  }).eq("id", target.id).eq("role", "client").eq("actif", true);
  if (targetError) redirect("/pharmacie/caisses?erreur=profil");

  const { error: provisionError } = await sb.rpc("naxa_provision_caisse", {
    p_target: target.id,
    p_pharmacie: pharmacieId,
  });
  if (provisionError) {
    const { error: restoreError } = await db.from("profiles").update(original).eq("id", target.id);
    if (restoreError) console.error("NAXA_CAISSE_ASSIGNMENT_RESTORE_FAILED", { targetId: target.id, message: restoreError.message });
    redirect("/pharmacie/caisses?erreur=provisionnement");
  }

  redirect("/pharmacie/caisses?ok=creation");
}

async function changerStatutCaisse(formData: FormData, actif: boolean) {
  const { sb } = await exigerPromoteur();
  const caisseId = value(formData, "caisse_id");
  if (!caisseId) redirect("/pharmacie/caisses?erreur=cible");

  // La RPC vérifie le parent, le scope, la validité commerciale et le quota
  // de réactivation. Pas de mise à jour directe en service-role.
  const { error } = await sb.rpc("naxa_set_caisse_status", {
    p_target: caisseId,
    p_active: actif,
  });
  redirect(error
    ? "/pharmacie/caisses?erreur=autorisation"
    : actif
      ? "/pharmacie/caisses?ok=reactivation"
      : "/pharmacie/caisses?ok=blocage");
}

export async function bloquerCaisse(formData: FormData) {
  await changerStatutCaisse(formData, false);
}

export async function reactiverCaisse(formData: FormData) {
  await changerStatutCaisse(formData, true);
}
