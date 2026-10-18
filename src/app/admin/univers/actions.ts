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
  const { error: flagError } = await sb.from("feature_flags").update({
    enabled, updated_by: actor, updated_at: new Date().toISOString(),
  }).eq("flag_key", flag);
  if (flagError) redirect("/admin/univers?erreur=schema");
  const { error } = await sb.from("universes").update({ enabled, updated_at: new Date().toISOString() }).eq("slug", slug);
  if (error) redirect("/admin/univers?erreur=schema");
  await sb.from("audit_log").insert({
    actor_id: actor, action: enabled ? "universe.enabled" : "universe.disabled",
    entity_type: "universe", entity_id: slug, metadata: { enabled },
  });
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
  const { error } = await sb.from("partner_universes").upsert({
    partner_id: partnerId, universe_slug: universe, enabled,
  }, { onConflict: "partner_id,universe_slug" });
  if (error) redirect("/admin/univers?erreur=association");
  await sb.from("audit_log").insert({
    actor_id: actor, action: enabled ? "partner.universe_enabled" : "partner.universe_disabled",
    entity_type: "partner_universe", entity_id: partnerId + ":" + universe,
    metadata: { partner_id: partnerId, universe_slug: universe, enabled },
  });
  revalidatePath("/admin/univers");
  revalidatePath("/" + universe);
  redirect("/admin/univers?ok=association");
}
