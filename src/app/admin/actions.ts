"use server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { PROMOTEUR_VALIDATION, normalizePromoteurPhone, validatePromoteurPhone, type PromoteurPhoneCountry } from "@/lib/promoteur-validation";
import { estCoordonneeCamerounaise } from "@/lib/server/delivery-routing";

async function exigerAdmin() {
  const { user } = await requireAdminActive("/admin");
  return user.id;
}

const value = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const ARCHITECTURES = ["ORPHELIN", "PARENTS_ENFANTS", "PARENTS_AINES_CADETS", "HYBRIDE"];

export async function creerPharmacie(formData: FormData) {
  const adminId = await exigerAdmin();
  const f = (key: string) => value(formData, key);
  const montant = Number(f("montant_mensuel"));
  const architecture = f("architecture_code");
  const username = f("username").trim().toLowerCase();
  const email = f("email").toLowerCase();
  const password = f("motdepasse");
  const phoneCountry = f("phone_country").toUpperCase() as PromoteurPhoneCountry;
  const phone = normalizePromoteurPhone(f("phone_number"), phoneCountry);
  const whatsapp = f("whatsapp").replace(/\D/g, "");
  const birthDate = new Date(f("date_of_birth"));
  const age = Date.now() >= birthDate.getTime()
    ? new Date().getUTCFullYear() - birthDate.getUTCFullYear() -
      (new Date().getUTCMonth() < birthDate.getUTCMonth() ||
      (new Date().getUTCMonth() === birthDate.getUTCMonth() && new Date().getUTCDate() < birthDate.getUTCDate()) ? 1 : 0)
    : -1;

  const errors: Record<string, string> = {};
  if (!f("nom")) errors.nom = "Le nom de la pharmacie est obligatoire.";
  if (!f("ville")) errors.ville = "La ville est obligatoire.";
  if (!/^[0-9]{8,15}$/.test(whatsapp)) errors.whatsapp = "Saisissez 8 à 15 chiffres pour WhatsApp.";
  if (!PROMOTEUR_VALIDATION.personName.test(f("first_name").trim())) errors.first_name = "Le prénom doit contenir 2 à 80 caractères.";
  if (!PROMOTEUR_VALIDATION.personName.test(f("last_name").trim())) errors.last_name = "Le nom doit contenir 2 à 80 caractères.";
  if (!(phoneCountry in PROMOTEUR_VALIDATION.phone)) errors.phone_number = "Choisissez un indicatif téléphonique valide.";
  if (!f("lat") || !Number.isFinite(Number(f("lat"))) || Number(f("lat")) < -90 || Number(f("lat")) > 90) errors.lat = "Latitude obligatoire entre -90 et 90.";
  if (!f("lng") || !Number.isFinite(Number(f("lng"))) || Number(f("lng")) < -180 || Number(f("lng")) > 180) errors.lng = "Longitude obligatoire entre -180 et 180.";
  if (f("lat") && f("lng") && !estCoordonneeCamerounaise({ lat: Number(f("lat")), lng: Number(f("lng")) })) {
    errors.lat = "Les coordonnées doivent correspondre à un emplacement situé au Cameroun.";
    errors.lng = "Vérifiez le couple latitude/longitude : pharmacie hors des limites géographiques camerounaises.";
  }
  if (!PROMOTEUR_VALIDATION.username.test(username)) errors.username = "3 à 30 caractères : lettres, chiffres, point, tiret ou underscore.";
  if (!PROMOTEUR_VALIDATION.email.test(email)) errors.email = "Adresse e-mail invalide.";
  if (password.length < PROMOTEUR_VALIDATION.passwordMinLength) errors.motdepasse = "6 caractères minimum.";
  if (validatePromoteurPhone(f("phone_number"), phoneCountry)) errors.phone_number = validatePromoteurPhone(f("phone_number"), phoneCountry)!;
  const dob = f("date_of_birth");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)) || (Number.isFinite(Date.parse(dob)) && new Date(dob).toISOString().slice(0, 10) !== dob) || new Date(dob).getTime() > Date.now() || age < 18) errors.date_of_birth = "Date valide requise ; âge minimum : 18 ans.";
  if (!Number.isSafeInteger(montant) || montant <= 0) errors.montant_mensuel = "Entier positif requis (FCFA).";
  if (!ARCHITECTURES.includes(architecture)) errors.architecture_code = "Architecture invalide.";
  if (Object.keys(errors).length) redirect("/admin?erreur=validation&univers=pharmacie&champs=" + encodeURIComponent(JSON.stringify(errors)));

  const db = supabaseAdmin();
  const { data: created, error: userError } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: {
      username, first_name: f("first_name"), last_name: f("last_name"),
      phone, phone_country: f("phone_country").toUpperCase(),
      date_of_birth: f("date_of_birth"), consent_accepted: true,
    },
  });
  if (userError || !created.user) { console.error("[admin.creerPharmacie] étape=auth.createUser", { code: userError?.code, message: userError?.message }); redirect("/admin?erreur=compte&univers=pharmacie"); }

  const userId = created.user.id;
  const { data: pharmacy, error: pharmacyError } = await db.from("pharmacies").insert({
    nom: f("nom"), ville: f("ville") || "Yaoundé", actif: false, visible_recherche: false, de_garde: false,
    quartier: f("quartier") || null, adresse: f("adresse") || null,
    lat: Number(f("lat")), lng: Number(f("lng")),
    geo_statut: "a_verifier",
    geo_source_type: f("geo_source_type") === "gps" ? "gps" : "saisie_manuelle",
    geo_mise_a_jour: new Date().toISOString(),
  }).select("id").single();

  if (pharmacyError || !pharmacy) {
    console.error("[admin.creerPharmacie] étape=pharmacies.insert", { code: pharmacyError?.code, message: pharmacyError?.message, details: pharmacyError?.details, hint: pharmacyError?.hint });
    await db.auth.admin.deleteUser(userId);
    redirect("/admin?erreur=pharmacie&univers=pharmacie");
  }

  const pharmacyId = pharmacy.id;
  const geoSource = f("geo_source_type") === "gps" ? "gps" : "saisie_manuelle";
  const { error: geoAuditError } = await db.from("naxa_pharmacie_geo_audit").insert({
    pharmacie_id: pharmacyId, acteur_id: adminId, role_acteur: "admin", event_type: "creation",
    source_type: geoSource, latitude_nouvelle: Number(f("lat")), longitude_nouvelle: Number(f("lng")),
    statut_nouveau: "a_verifier",
  });
  if (geoAuditError) console.error("[admin.creerPharmacie] geo_audit_insert", { code: geoAuditError.code, message: geoAuditError.message });
  const cleanup = async () => {
    const cleanupSteps = [
      ["pharmacie_documents_recus", () => db.from("pharmacie_documents_recus").delete().eq("pharmacie_id", pharmacyId)],
      ["promoteur_pharmacies", () => db.from("promoteur_pharmacies").delete().eq("promoteur_id", userId)],
      ["abonnements_promoteurs", () => db.from("abonnements_promoteurs").delete().eq("promoteur_id", userId)],
      ["conventions_promoteurs", () => db.from("conventions_promoteurs").delete().eq("promoteur_id", userId)],
      ["pharmacie_architectures", () => db.from("pharmacie_architectures").delete().eq("pharmacie_id", pharmacyId)],
      ["pharmacie_privee", () => db.from("pharmacie_privee").delete().eq("pharmacie_id", pharmacyId)],
    ] as const;
    const cleanupResults = await Promise.all(cleanupSteps.map(async ([table, run]) => {
      try {
        const { error } = await run();
        return { table, error: error?.message ?? null };
      } catch (error) {
        return { table, error: error instanceof Error ? error.message : String(error) };
      }
    }));
    const failedSteps = cleanupResults.filter((result) => result.error !== null);
    if (failedSteps.length > 0) {
      console.error("[admin.creerPharmacie] compensation_incomplete", {
        pharmacyId, userId, failedSteps,
      });
      return;
    }

    const { error: pharmacyDeleteError } = await db.from("pharmacies").delete().eq("id", pharmacyId);
    if (pharmacyDeleteError) {
      console.error("[admin.creerPharmacie] compensation_incomplete", {
        pharmacyId, userId, failedSteps: [{ table: "pharmacies", error: pharmacyDeleteError.message }],
      });
      return;
    }

    const { error: authDeleteError } = await db.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error("[admin.creerPharmacie] compensation_incomplete", {
        pharmacyId, userId, failedSteps: [{ table: "auth.users", error: authDeleteError.message }],
      });
      return;
    }
    console.info("[admin.creerPharmacie] compensation_complete", { pharmacyId, userId });
  };

  const { error: privateError } = await db.from("pharmacie_privee").insert({
    pharmacie_id: pharmacyId,
    whatsapp,
    code_marchand: null,
  });
  if (privateError) {
    console.error("[admin.creerPharmacie] étape=pharmacie_privee.insert", { code: privateError.code, message: privateError.message, details: privateError.details, hint: privateError.hint });
    await cleanup();
    redirect("/admin?erreur=profil&univers=pharmacie");
  }

  const { error: documentsError } = await db.from("pharmacie_documents_recus").insert({
    pharmacie_id: pharmacyId,
    kyc: formData.get("kyc") === "oui",
    piece_existence_legale: formData.get("piece_existence_legale") === "oui",
    registre_commerce: formData.get("registre_commerce") === "oui",
    niu: formData.get("niu") === "oui",
    attestation_non_redevance: formData.get("attestation_non_redevance") === "oui",
    plan_localisation: formData.get("plan_localisation") === "oui",
    cni_promoteur: formData.get("cni_promoteur") === "oui",
    mis_a_jour_par: adminId,
    mis_a_jour_le: new Date().toISOString(),
  });
  if (documentsError) {
    console.error("[admin.creerPharmacie] étape=pharmacie_documents_recus.insert", { code: documentsError.code, message: documentsError.message, details: documentsError.details, hint: documentsError.hint });
    await cleanup();
    redirect("/admin?erreur=documents&univers=pharmacie");
  }

  const { data: updatedProfile, error: profileError } = await db.from("profiles").update({
    role: "promoteur", fonction_interne: "promoteur",
    niveau_interne: 1, niveau_hierarchique: 1,
    pharmacie_id: pharmacyId, architecture_code: architecture,
    actif: false, parent_profile_id: null,
  }).eq("id", userId).select("id").maybeSingle();

  if (profileError || !updatedProfile) {
    console.error("[admin.creerPharmacie] étape=profiles.update", { code: profileError?.code, message: profileError?.message, details: profileError?.details, hint: profileError?.hint });
    await cleanup();
    redirect("/admin?erreur=profil&univers=pharmacie");
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
    console.error("[admin.creerPharmacie] étape=conventions_promoteurs.insert", { code: conventionError?.code, message: conventionError?.message, details: conventionError?.details, hint: conventionError?.hint });
    await cleanup();
    redirect("/admin?erreur=convention&univers=pharmacie");
  }

  const { data: arch, error: archError } = await db.from("naxa_architectures")
    .select("max_responsables,max_caisses")
    .eq("code", architecture).eq("active", true).single();

  if (archError || !arch) {
    console.error("[admin.creerPharmacie] étape=naxa_architectures.select", { code: archError?.code, message: archError?.message, details: archError?.details, hint: archError?.hint });
    await cleanup();
    redirect("/admin?erreur=architecture&univers=pharmacie");
  }

  const { error: abonnementError } = await db.from("abonnements_promoteurs").insert({
    promoteur_id: userId, convention_id: convention.id,
    montant_mensuel: montant, debut: new Date().toISOString().slice(0, 10),
    echeance: expiryDate, statut: "actif",
  });

  if (abonnementError) {
    console.error("[admin.creerPharmacie] étape=abonnements_promoteurs.insert", { code: abonnementError.code, message: abonnementError.message, details: abonnementError.details, hint: abonnementError.hint });
    await cleanup();
    redirect("/admin?erreur=abonnement&univers=pharmacie");
  }

  const { error: pharmacyArchitectureError } = await db.from("pharmacie_architectures").upsert({
    pharmacie_id: pharmacyId, architecture_code: architecture,
    assigned_by: adminId, active: false,
    max_responsables: arch.max_responsables ?? 0,
    max_caisses: arch.max_caisses,
  }, { onConflict: "pharmacie_id" });

  if (pharmacyArchitectureError) {
    console.error("[admin.creerPharmacie] étape=pharmacie_architectures.upsert", { code: pharmacyArchitectureError.code, message: pharmacyArchitectureError.message, details: pharmacyArchitectureError.details, hint: pharmacyArchitectureError.hint });
    await cleanup();
    redirect("/admin?erreur=architecture&univers=pharmacie");
  }

  const { error: linkError } = await db.from("promoteur_pharmacies").insert({
    promoteur_id: userId, pharmacie_id: pharmacyId, actif: false,
  });

  if (linkError) {
    console.error("[admin.creerPharmacie] étape=promoteur_pharmacies.insert", { code: linkError.code, message: linkError.message, details: linkError.details, hint: linkError.hint });
    await cleanup();
    redirect("/admin?erreur=reseau&univers=pharmacie");
  }

  redirect("/admin?ok=1&univers=pharmacie");
}
