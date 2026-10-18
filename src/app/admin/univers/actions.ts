"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

async function admin() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin/univers");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return { sb, actor: auth.user.id };
}

const field = (form: FormData, key: string, max = 160) => String(form.get(key) ?? "").trim().slice(0, max);
const slugs = ["parapharmacie", "bebe-maman", "examens", "suivi", "prestations", "aide"];
const types = ["parapharmacie", "maternite", "centre_examen", "professionnel_domicile", "autre"];

export async function creerPartenaire(form: FormData) {
  const { sb, actor } = await admin();
  const name = field(form, "name");
  const type = field(form, "partner_type", 40);
  const universe = field(form, "universe_slug", 40);
  if (name.length < 2 || !types.includes(type) || !slugs.includes(universe)) redirect("/admin/univers?erreur=parametres");
  const { data: partner, error } = await sb.from("partners").insert({
    name, partner_type: type, city: field(form, "city", 100) || "Yaoundé",
    neighborhood: field(form, "neighborhood", 120) || null,
    phone_private: field(form, "phone_private", 40) || null,
    status: "pending", created_by: actor,
  }).select("id").single();
  if (error || !partner) redirect("/admin/univers?erreur=schema");
  const { error: linkError } = await sb.from("partner_universes").insert({
    partner_id: partner.id, universe_slug: universe, enabled: false,
  });
  if (linkError) {
    await sb.from("partners").update({ status: "suspended" }).eq("id", partner.id);
    redirect("/admin/univers?erreur=association");
  }
  await sb.from("audit_log").insert({
    actor_id: actor, action: "partner.created", entity_type: "partner",
    entity_id: partner.id, metadata: { partner_type: type, universe_slug: universe, status: "pending" },
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=partenaire");
}

export async function changerStatutPartenaire(form: FormData) {
  const { sb, actor } = await admin();
  const id = field(form, "id", 40);
  const status = field(form, "status", 20);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["active", "suspended", "pending"].includes(status)) redirect("/admin/univers?erreur=parametres");
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "active") { patch.verified_at = new Date().toISOString(); patch.verified_by = actor; }
  const { error } = await sb.from("partners").update(patch).eq("id", id);
  if (error) redirect("/admin/univers?erreur=schema");
  await sb.from("audit_log").insert({
    actor_id: actor, action: "partner.status_changed", entity_type: "partner",
    entity_id: id, metadata: { status },
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=statut");
}

export async function changerActivationUnivers(form: FormData) {
  const { sb, actor } = await admin();
  const slug = field(form, "slug", 40);
  const flag = field(form, "flag_key", 100);
  const enabled = field(form, "enabled", 5) === "true";
  if (!slugs.includes(slug) || flag !== "universe." + slug || slug === "aide") redirect("/admin/univers?erreur=parametres");
  const { error } = await sb.rpc("admin_set_universe_enabled", { p_slug: slug, p_enabled: enabled });
  if (error) redirect("/admin/univers?erreur=schema");
  revalidatePath("/admin/univers");
  revalidatePath("/" + slug);
  redirect("/admin/univers?ok=activation");
}


export async function changerAssociationPartenaire(form: FormData) {
  const { sb, actor } = await admin();
  const partnerId = field(form, "partner_id", 40);
  const universe = field(form, "universe_slug", 40);
  const enabled = field(form, "enabled", 5) === "true";
  if (!/^[0-9a-f-]{36}$/i.test(partnerId) || !slugs.includes(universe)) redirect("/admin/univers?erreur=parametres");
  const { data: partner, error: partnerError } = await sb.from("partners").select("status").eq("id", partnerId).maybeSingle();
  if (partnerError || !partner) redirect("/admin/univers?erreur=schema");
  if (enabled && partner.status !== "active") redirect("/admin/univers?erreur=partenaire_inactif");
  const { error } = await sb.rpc("admin_set_partner_universe", {
    p_partner_id: partnerId, p_universe_slug: universe, p_enabled: enabled,
  });
  if (error) redirect("/admin/univers?erreur=association");
  revalidatePath("/admin/univers");
  revalidatePath("/" + universe);
  redirect("/admin/univers?ok=association");
}


export async function ajouterCompteTestSuivi(form: FormData) {
  const { sb, actor } = await admin();
  const userId = field(form, "user_id", 40);
  const reason = field(form, "reason", 240) || "Compte de test autorisé";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) redirect("/admin/univers?erreur=compte_test");
  const { error } = await sb.from("feature_flag_test_accounts").upsert({
    user_id: userId, reason, added_by: actor,
  }, { onConflict: "user_id" });
  if (error) redirect("/admin/univers?erreur=compte_test");
  await sb.from("audit_log").insert({
    actor_id: actor, action: "tracking.test_account_added", entity_type: "test_account",
    entity_id: userId, metadata: { reason },
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=compte_test");
}

export async function retirerCompteTestSuivi(form: FormData) {
  const { sb, actor } = await admin();
  const userId = field(form, "user_id", 40);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) redirect("/admin/univers?erreur=compte_test");
  const { error } = await sb.from("feature_flag_test_accounts").delete().eq("user_id", userId);
  if (error) redirect("/admin/univers?erreur=compte_test");
  await sb.from("audit_log").insert({
    actor_id: actor, action: "tracking.test_account_removed", entity_type: "test_account",
    entity_id: userId, metadata: {},
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=compte_test");
}
