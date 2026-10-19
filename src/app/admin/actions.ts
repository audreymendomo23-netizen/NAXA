"use server";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

async function exigerAdmin() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", auth.user.id).single();
  if (profile?.role !== "admin") redirect("/");
  return auth.user.id;
}

const value = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const ARCHITECTURES = ["ORPHELIN", "PARENTS_ENFANTS", "PARENTS_AINES_CADETS", "HYBRIDE"];

export async function creerPharmacie(formData: FormData) {
  const adminId = await exigerAdmin();
  const f = (key: string) => value(formData, key);
  const montant = Number(f("montant_mensuel"));
  const architecture = f("architecture_code");
  const username = f("username").toLowerCase();
  const email = f("email").toLowerCase();
  const password = f("motdepasse");
  const phone = f("phone").replace(/\s+/g, "");

  if (
    !f("nom") || !f("ville") || !f("whatsapp") ||
    !Number.isFinite(Number(f("lat"))) || !Number.isFinite(Number(f("lng"))) ||
    !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 12 || !/^\+?[0-9]{8,15}$/.test(phone) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(f("date_of_birth")) ||
    !Number.isSafeInteger(montant) || montant <= 0 ||
    !ARCHITECTURES.includes(architecture)
  ) redirect("/admin?erreur=validation");

  const db = supabaseAdmin();
  const { data: created, error: userError } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: {
      username, first_name: f("first_name"), last_name: f("last_name"),
      phone, phone_country: f("phone_country").toUpperCase(),
      date_of_birth: f("date_of_birth"), consent_accepted: true,
    },
  });
  if (userError || !created.user) redirect("/admin?erreur=compte");

  const userId = created.user.id;
  const { data: pharmacy, error: pharmacyError } = await db.from("pharmacies").insert({
    nom: f("nom"), ville: f("ville") || "Yaoundé",
    quartier: f("quartier") || null, adresse: f("adresse") || null,
    lat: Number(f("lat")), lng: Number(f("lng")),
  }).select("id").single();

  if (pharmacyError || !pharmacy) {
    await db.auth.admin.deleteUser(userId);
    redirect("/admin?erreur=pharmacie");
  }

  const pharmacyId = pharmacy.id;
  const cleanup = async () => {
    await db.from("promoteur_pharmacies").delete().eq("promoteur_id", userId);
    await db.from("abonnements_promoteurs").delete().eq("promoteur_id", userId);
    await db.from("conventions_promoteurs").delete().eq("promoteur_id", userId);
    await db.from("pharmacie_architectures").delete().eq("pharmacie_id", pharmacyId);
    await db.from("pharmacie_privee").delete().eq("pharmacie_id", pharmacyId);
    await db.from("pharmacies").delete().eq("id", pharmacyId);
    await db.auth.admin.deleteUser(userId);
  };

  const { error: privateError } = await db.from("pharmacie_privee").insert({
    pharmacie_id: pharmacyId,
    whatsapp: f("whatsapp").replace(/\D/g, ""),
    code_marchand: f("code_marchand") || null,
  });
  const { error: profileError } = await db.from("profiles").update({
    role: "promoteur", fonction_interne: "promoteur",
    niveau_interne: 1, niveau_hierarchique: 1,
    pharmacie_id: pharmacyId, architecture_code: architecture,
    actif: true, parent_profile_id: null,
  }).eq("id", userId);

  if (privateError || profileError) {
    await cleanup();
    redirect("/admin?erreur=profil");
  }

  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + 14);
  const expiryDate = expiry.toISOString().slice(0, 10);

  const { data: convention, error: conventionError } = await db.from("conventions_promoteurs").insert({
    promoteur_id: userId, montant_mensuel: montant,
    date_paiement: null, date_expiration: expiryDate,
    statut: "active", architecture_code: architecture,
  }).select("id").single();

  if (conventionError || !convention) {
    await cleanup();
    redirect("/admin?erreur=convention");
  }

  const { data: arch, error: archError } = await db.from("naxa_architectures")
    .select("max_responsables,max_caisses")
    .eq("code", architecture).eq("active", true).single();

  if (archError || !arch) {
    await cleanup();
    redirect("/admin?erreur=architecture");
  }

  const { error: abonnementError } = await db.from("abonnements_promoteurs").insert({
    promoteur_id: userId, convention_id: convention.id,
    montant_mensuel: montant, debut: new Date().toISOString().slice(0, 10),
    echeance: expiryDate, statut: "actif",
  });

  if (abonnementError) {
    await cleanup();
    redirect("/admin?erreur=abonnement");
  }

  const { error: pharmacyArchitectureError } = await db.from("pharmacie_architectures").upsert({
    pharmacie_id: pharmacyId, architecture_code: architecture,
    assigned_by: adminId, active: true,
    max_responsables: arch.max_responsables ?? 0,
    max_caisses: arch.max_caisses,
  }, { onConflict: "pharmacie_id" });

  if (pharmacyArchitectureError) {
    await cleanup();
    redirect("/admin?erreur=architecture");
  }

  const { error: linkError } = await db.from("promoteur_pharmacies").insert({
    promoteur_id: userId, pharmacie_id: pharmacyId, actif: true,
  });

  if (linkError) {
    await cleanup();
    redirect("/admin?erreur=reseau");
  }

  redirect("/admin?ok=1");
}
