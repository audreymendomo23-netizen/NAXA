"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { PROMOTEUR_VALIDATION, normalizePromoteurPhone, validatePromoteurPhone, type PromoteurPhoneCountry } from "@/lib/promoteur-validation";

const allowed = ["parapharmacie", "examens", "prestations", "aide"] as const;
const architectures = ["ORPHELIN", "PARENTS_ENFANTS", "PARENTS_AINES_CADETS", "HYBRIDE"];
const get = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function creerDossierUnivers(form: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin");
  const { data: admin } = await sb.from("profiles").select("role,actif").eq("id", auth.user.id).maybeSingle();
  if (admin?.role !== "admin" || admin.actif !== true) redirect("/");

  const universe = get(form, "universe_slug");
  const country = get(form, "phone_country").toUpperCase() as PromoteurPhoneCountry;
  const username = get(form, "username").toLowerCase();
  const email = get(form, "email").toLowerCase();
  const rawPhone = get(form, "phone_number");
  const dob = get(form, "date_of_birth");
  const password = get(form, "motdepasse");
  const amount = Number(get(form, "montant_mensuel"));
  const architecture = get(form, "architecture_code");
  const whatsapp = get(form, "whatsapp").replace(/\D/g, "");
  const latText = get(form, "lat");
  const lngText = get(form, "lng");
  const lat = latText ? Number(latText) : null;
  const lng = lngText ? Number(lngText) : null;
  const errors: Record<string, string> = {};
  if (!(allowed as readonly string[]).includes(universe)) errors.universe_slug = "Univers indépendant invalide.";
  if (get(form, "nom").length < 2 || get(form, "nom").length > 160) errors.nom = "2 à 160 caractères attendus.";
  if (get(form, "ville").length < 2) errors.ville = "Ville obligatoire.";
  if (get(form, "adresse").length < 2) errors.adresse = "Adresse obligatoire.";
  if (!/^[0-9]{8,15}$/.test(whatsapp)) errors.whatsapp = "8 à 15 chiffres attendus.";
  if (latText || lngText) {
    if (!latText || !lngText || !Number.isFinite(lat) || lat! < -90 || lat! > 90) errors.lat = "Latitude invalide.";
    if (!latText || !lngText || !Number.isFinite(lng) || lng! < -180 || lng! > 180) errors.lng = "Longitude invalide.";
  }
  if (!PROMOTEUR_VALIDATION.personName.test(get(form, "first_name"))) errors.first_name = "2 à 80 caractères attendus.";
  if (!PROMOTEUR_VALIDATION.personName.test(get(form, "last_name"))) errors.last_name = "2 à 80 caractères attendus.";
  if (!PROMOTEUR_VALIDATION.username.test(username)) errors.username = "Nom d’utilisateur invalide.";
  if (!(country in PROMOTEUR_VALIDATION.phone) || validatePromoteurPhone(rawPhone, country)) errors.phone_number = validatePromoteurPhone(rawPhone, country) ?? "Indicatif invalide.";
  if (!PROMOTEUR_VALIDATION.email.test(email)) errors.email = "Adresse e-mail invalide.";
  if (password.length < PROMOTEUR_VALIDATION.passwordMinLength) errors.motdepasse = "6 caractères minimum.";
  const birth = new Date(dob);
  const today = new Date();
  const age = Number.isNaN(birth.getTime()) ? -1 : today.getUTCFullYear() - birth.getUTCFullYear() -
    (today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate()) ? 1 : 0);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dob) || Number.isNaN(birth.getTime()) || birth.toISOString().slice(0,10) !== dob || birth.getTime() > Date.now() || age < 18) errors.date_of_birth = "Âge minimum : 18 ans.";
  if (!Number.isSafeInteger(amount) || amount <= 0) errors.montant_mensuel = "Montant FCFA invalide.";
  if (universe === "parapharmacie" && !architectures.includes(architecture)) errors.architecture_code = "Architecture requise.";
  if (universe !== "parapharmacie" && architecture) errors.architecture_code = "Architecture interdite pour cet univers.";
  if (Object.keys(errors).length) redirect("/admin?erreur=validation&univers=" + encodeURIComponent(universe) + "&champs=" + encodeURIComponent(JSON.stringify(errors)));

  const db = supabaseAdmin();
  const created = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: {
      username, first_name: get(form, "first_name"), last_name: get(form, "last_name"),
      phone: normalizePromoteurPhone(rawPhone, country), phone_country: country,
      date_of_birth: dob, consent_accepted: true,
    },
  });
  if (created.error || !created.data.user) redirect("/admin?erreur=compte&univers=" + encodeURIComponent(universe));
  const ownerId = created.data.user.id;
  const docs = {
    piece_existence_legale: form.get("piece_existence_legale") === "oui",
    registre_commerce: form.get("registre_commerce") === "oui",
    niu: form.get("niu") === "oui",
    attestation_non_redevance: form.get("attestation_non_redevance") === "oui",
    plan_localisation: form.get("plan_localisation") === "oui",
    cni_promoteur: form.get("cni_promoteur") === "oui",
  };
  const { data: partnerId, error } = await sb.rpc("admin_create_partner_dossier", {
    p_owner_user_id: ownerId, p_name: get(form, "nom"),
    p_partner_type: universe === "parapharmacie" ? "parapharmacie" : universe === "examens" ? "centre_examen" : universe === "prestations" ? "professionnel_domicile" : "autre",
    p_universe_slug: universe, p_city: get(form, "ville"), p_neighborhood: get(form, "quartier") || null,
    p_address: get(form, "adresse") || null, p_latitude: lat, p_longitude: lng,
    p_whatsapp: whatsapp, p_monthly_fee_fcfa: amount,
    p_architecture_code: universe === "parapharmacie" ? architecture : null,
    p_documents_received: docs,
  });
  if (error || !partnerId) {
    await db.auth.admin.deleteUser(ownerId);
    redirect("/admin?erreur=dossier&univers=" + encodeURIComponent(universe));
  }
  revalidatePath("/admin");
  revalidatePath("/admin/promoteurs");
  revalidatePath("/admin/univers");
  redirect("/admin?ok=dossier&univers=" + encodeURIComponent(universe));
}
