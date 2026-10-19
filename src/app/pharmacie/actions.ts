"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

async function exigerPromoteur() {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/connexion?retour=/pharmacie/caisses");
  const { data: p } = await sb
    .from("profiles")
    .select("id,role,actif")
    .eq("id", u.user.id)
    .single();
  if (p?.role !== "promoteur" || p.actif !== true) redirect("/");
  return { userId: u.user.id, sb };
}

const value = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function creerCaisse(formData: FormData) {
  const { userId, sb } = await exigerPromoteur();
  const pharmacieId = value(formData, "pharmacie_id");
  const username = value(formData, "username").toLowerCase();
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "motdepasse");
  const firstName = value(formData, "first_name");
  const lastName = value(formData, "last_name");
  const phone = value(formData, "phone").replace(/\s+/g, "");
  const country = value(formData, "phone_country").toUpperCase();
  const dob = value(formData, "date_of_birth");

  if (
    !pharmacieId ||
    !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 12 ||
    firstName.length < 2 ||
    lastName.length < 2 ||
    !/^\+?[0-9]{8,15}$/.test(phone) ||
    !/^[A-Z]{2}$/.test(country) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dob)
  ) redirect("/pharmacie/caisses?erreur=validation");

  // Le périmètre vient du réseau canonique, jamais de profiles.pharmacie_id.
  const { data: lien, error: lienError } = await sb
    .from("promoteur_pharmacies")
    .select("pharmacie_id")
    .eq("promoteur_id", userId)
    .eq("pharmacie_id", pharmacieId)
    .eq("actif", true)
    .maybeSingle();
  if (lienError || !lien) redirect("/pharmacie/caisses?erreur=perimetre");

  // Vérifier les droits et quotas côté serveur avant de créer le compte.
  const { data: autorise, error: authError } = await sb.rpc("naxa_can", {
    p_privilege: "CREATE_CAISSE",
    p_pharmacie: pharmacieId,
    p_target: null,
  });
  if (authError || autorise !== true) redirect("/pharmacie/caisses?erreur=autorisation");

  const db = supabaseAdmin();
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      first_name: firstName,
      last_name: lastName,
      phone,
      phone_country: country,
      date_of_birth: dob,
      consent_accepted: true,
    },
  });
  if (createError || !created.user) redirect("/pharmacie/caisses?erreur=creation");

  // Créer d'abord une cible Caisse vierge, puis la provisionner par la RPC
  // authentifiée qui applique architecture, quota, parent et périmètre.
  const { error: targetError } = await db
    .from("profiles")
    .update({
      role: "caisse",
      fonction_interne: "caisse",
      niveau_interne: 3,
      niveau_hierarchique: 3,
      pharmacie_id: null,
      parent_profile_id: null,
      architecture_code: null,
      actif: false,
    })
    .eq("id", created.user.id);

  if (targetError) {
    await db.auth.admin.deleteUser(created.user.id);
    redirect("/pharmacie/caisses?erreur=profil");
  }

  const { error: provisionError } = await sb.rpc("naxa_provision_caisse", {
    p_target: created.user.id,
    p_pharmacie: pharmacieId,
  });
  if (provisionError) {
    // Aucun compte enfant orphelin si le quota ou l'architecture refuse l'opération.
    await db.auth.admin.deleteUser(created.user.id);
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
