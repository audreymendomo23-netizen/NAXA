#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { randomBytes } = require("node:crypto");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const EMAIL = "naxa.e2e.promoteur@example.invalid";
const USERNAME = "naxa_e2e_promoteur";
const PHONE = "+237000000001";
const MONTHLY_FEE_FCFA = 1;
const TERM_DAYS = 30;

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co" || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : provisionnement limité au projet Supabase Replay " + PROJECT_REF + ".");
  }
  return url.origin;
}

function chooseHybridPharmacies(pharmacies, architectures, links, promoterId) {
  const hybrid = new Set(architectures.filter(x => x.active === true && x.architecture_code === "HYBRIDE").map(x => x.pharmacie_id));
  const eligible = pharmacies.filter(x => x.est_demo === true && x.actif === true && x.visible_recherche === true && x.archivee_le == null && hybrid.has(x.id));
  const occupied = new Set(links.filter(x => x.actif === true && x.promoteur_id !== promoterId).map(x => x.pharmacie_id));
  const selected = [];
  for (const x of links.filter(x => x.actif === true && x.promoteur_id === promoterId)) {
    if (eligible.some(p => p.id === x.pharmacie_id) && !selected.includes(x.pharmacie_id)) selected.push(x.pharmacie_id);
  }
  for (const p of eligible) {
    if (selected.length === 2) break;
    if (!occupied.has(p.id) && !selected.includes(p.id)) selected.push(p.id);
  }
  if (selected.length !== 2) throw new Error("Deux pharmacies démo actives HYBRIDE et libres sont requises sur Replay.");
  return selected;
}

function buildProfileMetadata() {
  return {
    username: USERNAME,
    first_name: "Compte",
    last_name: "Promoteur E2E",
    phone: PHONE,
    phone_country: "CM",
    date_of_birth: "1990-01-01",
    consent_accepted: true,
    naxa_signup_completed: true,
    naxa_signup_pending: false,
    naxa_e2e_promoteur: true,
    naxa_e2e_fixture: true,
  };
}

function generateEphemeralPassword() {
  return randomBytes(32).toString("base64url") + "Aa!9";
}

async function provision(env = process.env) {
  const baseUrl = assertReplayUrl(env.SUPABASE_URL || env.NAXA_STORAGE_E2E_URL || "");
  const adminKey = String(env.SUPABASE_SERVICE_ROLE_KEY || env.NAXA_STORAGE_E2E_ADMIN_KEY || "").trim();
  if (!adminKey) throw new Error("Clé de service Replay absente des secrets du job.");
  const password = generateEphemeralPassword();

  const headers = { apikey: adminKey, Authorization: "Bearer " + adminKey, "Content-Type": "application/json" };
  async function api(path, method = "GET", body, prefer) {
    const requestHeaders = { ...headers };
    if (prefer) requestHeaders.Prefer = prefer;
    const response = await fetch(baseUrl + path, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* corps Auth non journalisé */ }
    if (!response.ok) {
      const code = data && typeof data.code === "string" ? " (" + data.code + ")" : "";
      throw new Error("Supabase a refusé une opération de provisionnement (HTTP " + response.status + code + ").");
    }
    return data;
  }

  // Préflight intégral avant toute création : environnement, identité, nom, téléphone et pharmacies.
  const [pharmacies, architectures, links, usernameRows, phoneRows, listed] = await Promise.all([
    api("/rest/v1/pharmacies?select=id,est_demo,actif,visible_recherche,archivee_le&est_demo=eq.true&actif=eq.true&visible_recherche=eq.true&archivee_le=is.null&order=created_at.asc&limit=100"),
    api("/rest/v1/pharmacie_architectures?select=pharmacie_id,architecture_code,active&active=eq.true&architecture_code=eq.HYBRIDE&limit=100"),
    api("/rest/v1/promoteur_pharmacies?select=promoteur_id,pharmacie_id,actif&limit=1000"),
    api("/rest/v1/profiles?select=id,username&username=eq." + encodeURIComponent(USERNAME) + "&limit=2"),
    api("/rest/v1/profiles?select=id&phone=eq." + encodeURIComponent(PHONE) + "&limit=2"),
    api("/auth/v1/admin/users?page=1&per_page=1000"),
  ]);
  const users = Array.isArray(listed && listed.users) ? listed.users : [];
  let user = users.find(x => String(x.email || "").trim().toLowerCase() === EMAIL) || null;
  if (user && user.user_metadata?.naxa_e2e_promoteur !== true) throw new Error("L'adresse E2E existe mais n'est pas marquée fixture NAXA ; aucune modification.");
  const promoterId = user?.id || null;
  if ((usernameRows || []).some(x => x.id !== promoterId)) throw new Error("Le nom technique E2E est déjà utilisé par un autre profil.");
  if ((phoneRows || []).some(x => x.id !== promoterId)) throw new Error("Le téléphone synthétique E2E est déjà associé à un autre profil.");
  const pharmacyIds = chooseHybridPharmacies(pharmacies || [], architectures || [], links || [], promoterId);

  let created = false;
  if (!user) {
    const result = await api("/auth/v1/admin/users", "POST", {
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: buildProfileMetadata(),
    });
    user = result?.user || result;
    if (!user?.id) throw new Error("Supabase Auth n'a pas retourné l'identité créée.");
    created = true;
  } else {
    // Fixture E2E dédiée : mot de passe aléatoire renouvelé pour ce seul job, jamais journalisé.
    await api("/auth/v1/admin/users/" + encodeURIComponent(user.id), "PUT", {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), ...buildProfileMetadata() },
    });
  }

  const profiles = await api("/rest/v1/profiles?select=id,role,actif,pharmacie_id&id=eq." + encodeURIComponent(user.id) + "&limit=1");
  if (!Array.isArray(profiles) || profiles.length !== 1) throw new Error("Le trigger Auth n'a pas créé le profil attendu ; identité conservée pour diagnostic et reprise idempotente.");
  if (!["client", "promoteur"].includes(profiles[0].role)) throw new Error("Le profil Auth existe avec un rôle incompatible ; aucune conversion.");

  // Conversion de fixture uniquement : identité marquée E2E et URL épinglée Replay.
  await api("/rest/v1/profiles?id=eq." + encodeURIComponent(user.id), "PATCH", {
    role: "promoteur", actif: true, pharmacie_id: pharmacyIds[0],
  }, "return=representation");

  const today = new Date().toISOString().slice(0, 10);
  const expiry = new Date(Date.now() + TERM_DAYS * 86400000).toISOString().slice(0, 10);
  const conventions = await api("/rest/v1/conventions_promoteurs?on_conflict=promoteur_id", "POST", {
    promoteur_id: user.id,
    montant_mensuel: MONTHLY_FEE_FCFA,
    date_paiement: null,
    date_expiration: expiry,
    statut: "active",
    architecture_code: "HYBRIDE",
  }, "resolution=merge-duplicates,return=representation");
  let conventionId = Array.isArray(conventions) ? conventions[0]?.id : null;
  if (!conventionId) {
    const existing = await api("/rest/v1/conventions_promoteurs?select=id&promoteur_id=eq." + encodeURIComponent(user.id) + "&limit=1");
    conventionId = existing?.[0]?.id;
  }
  if (!conventionId) throw new Error("Convention de recette introuvable après provisionnement.");

  await api("/rest/v1/abonnements_promoteurs?on_conflict=promoteur_id", "POST", {
    promoteur_id: user.id, convention_id: conventionId, montant_mensuel: MONTHLY_FEE_FCFA,
    debut: today, echeance: expiry, statut: "actif", bloque_le: null,
  }, "resolution=merge-duplicates,return=minimal");

  await api("/rest/v1/promoteur_pharmacies?on_conflict=promoteur_id,pharmacie_id", "POST",
    pharmacyIds.map(pharmacie_id => ({ promoteur_id: user.id, pharmacie_id, actif: true })),
    "resolution=merge-duplicates,return=minimal");

  const [verifiedProfile, verifiedLinks, privileges] = await Promise.all([
    api("/rest/v1/profiles?select=id,role,actif&id=eq." + encodeURIComponent(user.id) + "&limit=1"),
    api("/rest/v1/promoteur_pharmacies?select=pharmacie_id,actif&promoteur_id=eq." + encodeURIComponent(user.id) + "&actif=eq.true"),
    api("/rest/v1/naxa_profile_privileges?select=pharmacie_id,privilege_code,active,revoked_at&profile_id=eq." + encodeURIComponent(user.id) + "&active=eq.true"),
  ]);
  if (verifiedProfile?.[0]?.role !== "promoteur" || verifiedProfile?.[0]?.actif !== true) throw new Error("Le profil Promoteur n'est pas actif après provisionnement.");
  const linked = new Set((verifiedLinks || []).map(x => x.pharmacie_id));
  if (pharmacyIds.some(id => !linked.has(id))) throw new Error("Les deux liens Promoteur/pharmacie ne sont pas actifs.");
  const canAssign = new Set((privileges || []).filter(x => x.privilege_code === "ASSIGN_USER_TO_PHARMACY" && x.revoked_at == null).map(x => x.pharmacie_id));
  if (pharmacyIds.some(id => !canAssign.has(id))) throw new Error("Privilège d'affectation automatique absent sur une pharmacie.");

  await api("/rest/v1/audit_log", "POST", {
    actor_id: null, action: "e2e.promoteur_seeded", entity_type: "e2e_fixture", entity_id: user.id,
    metadata: {
      test_fixture: true, project_ref: PROJECT_REF, architecture_code: "HYBRIDE",
      pharmacy_ids: pharmacyIds, convention_id: conventionId,
      subscription_amount_fcfa: MONTHLY_FEE_FCFA, subscription_is_test_only: true,
      payment_record_created: false, synthetic_identity_and_consent: true,
    },
  }, "return=minimal");

  if (env.GITHUB_ENV) {
    fs.appendFileSync(env.GITHUB_ENV,
      "NAXA_STORAGE_E2E_PROMOTEUR_EMAIL=" + EMAIL + "\n" +
      "NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD=" + password + "\n" +
      "NAXA_STORAGE_E2E_PROMOTEUR_PHARMACY_ID=" + pharmacyIds[0] + "\n" +
      "NAXA_STORAGE_E2E_OTHER_PHARMACY_ID=" + pharmacyIds[1] + "\n",
      { encoding: "utf8", mode: 0o600 }
    );
  }
  process.stdout.write("PASS — identité Promoteur E2E Replay " + (created ? "créée" : "reprise") + ".\n");
  process.stdout.write("PASS — 2 pharmacies démo HYBRIDE liées et privilèges d'affectation vérifiés.\n");
  process.stdout.write("INFO — convention et abonnement de test 1 FCFA/30 jours ; aucun paiement enregistré.\n");
  process.stdout.write("PROMOTEUR_ID=" + user.id + "\nPHARMACY_ID=" + pharmacyIds[0] + "\nOTHER_PHARMACY_ID=" + pharmacyIds[1] + "\n");
}

if (require.main === module) {
  provision().catch(error => {
    process.stderr.write("PROVISIONNEMENT PROMOTEUR E2E BLOQUÉ — " + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl, chooseHybridPharmacies, buildProfileMetadata, generateEphemeralPassword };
