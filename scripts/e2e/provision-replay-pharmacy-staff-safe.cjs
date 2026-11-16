#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { randomBytes } = require("node:crypto");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const FIXTURE_MARKER = "NAXA-E2E-PHARMACY-STAFF-20261115";
const PHARMACY = process.env.NAXA_STORAGE_E2E_PROMOTEUR_PHARMACY_ID || "";
const PROMOTER_EMAIL = "naxa.e2e.promoteur@example.invalid";
const PERSONAS = [
  {
    key: "stock",
    email: "naxa.e2e.stock@example.invalid",
    username: "naxa_e2e_stock",
    phone: "+237600000096",
    firstName: "Compte",
    lastName: "Gestionnaire Stock E2E",
    role: "gestionnaire_stock",
  },
  {
    key: "caisse",
    email: "naxa.e2e.caisse@example.invalid",
    username: "naxa_e2e_caisse",
    phone: "+237600000095",
    firstName: "Compte",
    lastName: "Caisse E2E",
    role: "caisse",
  },
  {
    key: "client",
    email: "naxa.e2e.client-acheteur@example.invalid",
    username: "naxa_e2e_acheteur",
    phone: "+237600000094",
    firstName: "Compte",
    lastName: "Client Acheteur E2E",
    role: "client",
  },
  {
    key: "comptable",
    email: "naxa.e2e.comptable@example.invalid",
    username: "naxa_e2e_comptable",
    phone: "+237600000090",
    firstName: "Compte",
    lastName: "Comptable E2E",
    role: "comptable",
  },
  {
    key: "pharmacien",
    email: "naxa.e2e.pharmacien@example.invalid",
    username: "naxa_e2e_pharmacien",
    phone: "+237600000089",
    firstName: "Compte",
    lastName: "Pharmacien E2E",
    role: "pharmacien",
  },
];

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co" || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : les fixtures du personnel sont limitées au projet Replay " + PROJECT_REF + ".");
  }
  return url.origin;
}

function buildMetadata(persona) {
  return {
    username: persona.username,
    first_name: persona.firstName,
    last_name: persona.lastName,
    phone: persona.phone,
    phone_country: "CM",
    date_of_birth: "1990-01-01",
    consent_accepted: true,
    naxa_signup_completed: true,
    naxa_signup_pending: false,
    naxa_e2e_fixture: FIXTURE_MARKER,
    naxa_e2e_persona: persona.key,
  };
}

function assertFixture(user, profile, persona) {
  if (!user || !profile) throw new Error("Compte Auth/profil absent pour " + persona.key + ".");
  if (String(user.email || "").trim().toLowerCase() !== persona.email) {
    throw new Error("Adresse Auth inattendue pour " + persona.key + ".");
  }
  if (!user.id || profile.id !== user.id) throw new Error("Profil non lié à l'identité Auth pour " + persona.key + ".");
  if (!user.email_confirmed_at) throw new Error("Adresse non confirmée pour " + persona.key + ".");
  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  if (metadata.naxa_e2e_fixture !== FIXTURE_MARKER
    || metadata.naxa_e2e_persona !== persona.key
    || metadata.username !== persona.username
    || metadata.naxa_signup_completed !== true) {
    throw new Error("Marqueurs E2E incompatibles pour " + persona.key + " ; aucune conversion de compte.");
  }
  if (profile.role !== "client" || profile.actif !== true || profile.age_verified !== true
    || !profile.consent_accepted_at || profile.username !== persona.username
    || profile.first_name !== persona.firstName || profile.last_name !== persona.lastName
    || profile.phone !== persona.phone || !profile.date_of_birth) {
    throw new Error("Profil racine Client incomplet, inactif ou non conforme pour " + persona.key + ".");
  }
  return true;
}

function generateEphemeralPassword() {
  return randomBytes(32).toString("base64url") + "Aa!9";
}

function buildTestCredentialPdf() {
  const content = "BT /F1 12 Tf 24 110 Td (NAXA E2E TEST DOCUMENT - NOT A REAL LICENSE OR PRESCRIPTION) Tj 0 -22 Td (Replay-only staff and client prescription workflow validation) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 160] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + Buffer.byteLength(content, "utf8") + " >>\nstream\n" + content + "\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += (i + 1) + " 0 obj\n" + objects[i] + "\nendobj\n";
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, "0") + " 00000 n \n";
  pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return Buffer.from(pdf, "utf8");
}

function buildClientPrescriptionObjectPath(clientId, pharmacyId, nonce) {
  for (const [label, value] of [["Client", clientId], ["pharmacie", pharmacyId], ["nonce", nonce]]) {
    if (!/^[a-zA-Z0-9-]+$/.test(String(value || ""))) {
      throw new Error("Composant de chemin Storage invalide : " + label + ".");
    }
  }
  return clientId + "/" + pharmacyId + "/naxa-e2e-prescription-" + nonce + ".pdf";
}

async function provision(env = process.env) {
  const baseUrl = assertReplayUrl(env.SUPABASE_URL || env.NAXA_STORAGE_E2E_URL || "");
  const adminKey = String(env.SUPABASE_SERVICE_ROLE_KEY || env.NAXA_STORAGE_E2E_ADMIN_KEY || "").trim();
  const anonKey = String(env.NAXA_STORAGE_E2E_ANON_KEY || "").trim();
  const promoterEmail = String(env.NAXA_STORAGE_E2E_PROMOTEUR_EMAIL || PROMOTER_EMAIL).trim();
  const promoterPasswordFile = String(env.NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD_FILE || "").trim();
  const pharmacyId = String(env.NAXA_STORAGE_E2E_PROMOTEUR_PHARMACY_ID || PHARMACY).trim();
  if (!adminKey || !anonKey || !promoterPasswordFile || !pharmacyId) {
    throw new Error("Secrets Replay, fichier secret Promoteur et pharmacie E2E requis.");
  }
  if (!fs.existsSync(promoterPasswordFile)) throw new Error("Fichier secret Promoteur absent.");
  const promoterPassword = fs.readFileSync(promoterPasswordFile, "utf8");
  if (!promoterPassword) throw new Error("Fichier secret Promoteur vide.");

  const roleSessions = [];
  let failed = false;

  async function request(path, options = {}) {
    const apiKey = options.apiKey || anonKey;
    const headers = { apikey: apiKey, "Content-Type": "application/json" };
    if (options.accessToken) headers.Authorization = "Bearer " + options.accessToken;
    else if (!apiKey.startsWith("sb_secret_") && !apiKey.startsWith("sb_publishable_")) {
      headers.Authorization = "Bearer " + apiKey;
    }
    const response = await fetch(baseUrl + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* ne jamais journaliser les corps Auth */ }
    return { ok: response.ok, status: response.status, data };
  }

  async function adminRequest(path, method = "GET", body) {
    const result = await request(path, { method, apiKey: adminKey, body });
    if (!result.ok) {
      const code = result.data && typeof result.data.code === "string" ? " (" + result.data.code + ")" : "";
      throw new Error("Supabase a refusé une opération de fixture Replay (HTTP " + result.status + code + ").");
    }
    return result.data;
  }

  async function restAdmin(path) {
    return adminRequest("/rest/v1/" + path);
  }

  async function rpc(path, accessToken, args) {
    return request("/rest/v1/rpc/" + path, { method: "POST", accessToken, body: args || {} });
  }

  async function login(email, password, label) {
    const result = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
    });
    if (!result.ok || !result.data?.access_token || !result.data?.user?.id) {
      throw new Error("Connexion du compte " + label + " impossible (HTTP " + result.status + ").");
    }
    roleSessions.push(result.data.access_token);
    return { id: result.data.user.id, token: result.data.access_token };
  }

  // Insert-only upload: the bucket policy deliberately has no UPDATE grant.
  // The Storage MIME policy also accepts the safe file extension when metadata.mimetype is absent.
  async function uploadPharmacistCredential(accessToken, objectPath) {
    const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(
      baseUrl + "/storage/v1/object/naxa-pharmacien-accreditations/" + encodedPath,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/pdf",
        },
        body: buildTestCredentialPdf(),
      }
    );
    if (!response.ok) {
      const raw = await response.text();
      let detail = "";
      try {
        const payload = JSON.parse(raw);
        detail = String(payload.message || payload.error || payload.statusCode || "");
      } catch {
        detail = raw.replace(/[\\r\\n]+/g, " ").slice(0, 180);
      }
      throw new Error(
        "Dépôt du justificatif Pharmacien E2E refusé (HTTP " + response.status
        + (detail ? " : " + detail : "") + ")."
      );
    }
  }

  async function logout(accessToken) {
    const result = await request("/auth/v1/logout?scope=local", { method: "POST", accessToken });
    if (!result.ok && result.status !== 401 && result.status !== 404) {
      throw new Error("Fermeture locale d'une session E2E impossible (HTTP " + result.status + ").");
    }
  }

  async function findAuthFixture(persona) {
    const matches = [];
    for (let page = 1; page <= 20; page += 1) {
      const listed = await adminRequest("/auth/v1/admin/users?page=" + page + "&per_page=50");
      const users = Array.isArray(listed?.users) ? listed.users
        : Array.isArray(listed?.data?.users) ? listed.data.users
          : Array.isArray(listed) ? listed : [];
      matches.push(...users.filter(x => String(x.email || "").trim().toLowerCase() === persona.email));
      if (users.length < 50) break;
    }
    if (matches.length > 1) throw new Error("Identité Auth dupliquée pour " + persona.key + ".");
    return matches[0] || null;
  }

  async function provisionIdentity(persona) {
    const usernameRows = await restAdmin(
      "profiles?select=id,username&username=eq." + encodeURIComponent(persona.username) + "&limit=2"
    );
    const phoneRows = await restAdmin(
      "profiles?select=id,phone&phone=eq." + encodeURIComponent(persona.phone) + "&limit=2"
    );
    if (!Array.isArray(usernameRows) || !Array.isArray(phoneRows)) {
      throw new Error("Contrôle d'unicité incomplet pour " + persona.key + ".");
    }
    let user = await findAuthFixture(persona);
    const password = generateEphemeralPassword();

    if (user) {
      const profiles = await restAdmin(
        "profiles?select=id,role,actif,age_verified,consent_accepted_at,username,first_name,last_name,phone,date_of_birth&id=eq."
          + encodeURIComponent(user.id) + "&limit=2"
      );
      if (!Array.isArray(profiles) || profiles.length !== 1) {
        throw new Error("Profil attendu absent pour " + persona.key + ".");
      }
      assertFixture(user, profiles[0], persona);
      if (usernameRows.some(row => row.id !== user.id) || phoneRows.some(row => row.id !== user.id)) {
        throw new Error("Nom d'utilisateur ou téléphone déjà utilisé par un autre profil.");
      }
      await adminRequest("/auth/v1/admin/users/" + encodeURIComponent(user.id), "PUT", { password });
    } else {
      if (usernameRows.length || phoneRows.length) {
        throw new Error("Identifiant technique ou téléphone déjà utilisé ; création de " + persona.key + " refusée.");
      }
      const created = await adminRequest("/auth/v1/admin/users", "POST", {
        email: persona.email,
        password,
        email_confirm: true,
        user_metadata: buildMetadata(persona),
      });
      user = created?.user || created;
      if (!user?.id) throw new Error("Supabase Auth n'a pas retourné l'identité " + persona.key + ".");
    }

    const verified = await findAuthFixture(persona);
    if (!verified || verified.id !== user.id) throw new Error("Identité Auth non unique après provisionnement.");
    const profiles = await restAdmin(
      "profiles?select=id,role,actif,age_verified,consent_accepted_at,username,first_name,last_name,phone,date_of_birth&id=eq."
        + encodeURIComponent(user.id) + "&limit=2"
    );
    if (!Array.isArray(profiles) || profiles.length !== 1) throw new Error("Profil non créé pour " + persona.key + ".");
    assertFixture(verified, profiles[0], persona);
    return { id: user.id, password };
  }

  try {
    const promoter = await login(promoterEmail, promoterPassword, "Promoteur E2E");
    const promoterWorkspace = await rpc("naxa_select_active_role", promoter.token, {
      p_role_code: "promoteur",
      p_pharmacie_id: null,
      p_partner_id: null,
    });
    if (!promoterWorkspace.ok || promoterWorkspace.data !== true) {
      throw new Error("Activation de l'espace Promoteur E2E refusée (HTTP " + promoterWorkspace.status + ").");
    }
    const promoterBusinessFunction = await rpc("naxa_business_function", promoter.token, {});
    if (!promoterBusinessFunction.ok || promoterBusinessFunction.data !== "promoteur") {
      throw new Error("Le contexte actif du compte E2E n'est pas Promoteur.");
    }
    const pharmacy = await restAdmin(
      "pharmacies?select=id,actif,archivee_le&id=eq." + encodeURIComponent(pharmacyId) + "&limit=1"
    );
    if (!Array.isArray(pharmacy) || pharmacy.length !== 1
      || pharmacy[0].actif !== true || pharmacy[0].archivee_le !== null) {
      throw new Error("Pharmacie E2E inactive, archivée ou introuvable.");
    }

    const fixtures = {};
    for (const persona of PERSONAS) {
      fixtures[persona.key] = await provisionIdentity(persona);
    }

    // Keep short-lived credentials for each role available to later Replay
    // runtime/browser steps. They are files with mode 0600, never logs.
    if (!env.GITHUB_ENV || !env.RUNNER_TEMP) {
      throw new Error("Export des secrets E2E autorisé uniquement depuis GitHub Actions.");
    }
    for (const key of ["client", "caisse", "stock", "comptable", "pharmacien"]) {
      const passwordFile = env.RUNNER_TEMP + "/naxa-e2e-" + key + "-" + randomBytes(8).toString("hex") + ".secret";
      fs.writeFileSync(passwordFile, fixtures[key].password, { encoding: "utf8", flag: "wx", mode: 0o600 });
      const variable = "NAXA_STORAGE_E2E_" + key.toUpperCase() + "_PASSWORD_FILE";
      fs.appendFileSync(env.GITHUB_ENV, variable + "=" + passwordFile + "\n", { encoding: "utf8", mode: 0o600 });
    }

    for (const persona of PERSONAS.filter(item => item.role !== "client")) {
      const rows = await restAdmin(
        "naxa_professional_assignments?select=id,pharmacie_id,role_code,statut,commence_at,expire_at"
          + "&profile_id=eq." + encodeURIComponent(fixtures[persona.key].id)
          + "&statut=eq.active&commence_at=lte." + encodeURIComponent(new Date().toISOString())
          + "&limit=20"
      );
      if (!Array.isArray(rows)) throw new Error("Lecture des affectations impossible pour " + persona.key + ".");
      const active = rows.filter(row => !row.expire_at || new Date(row.expire_at).getTime() > Date.now());
      if (active.some(row => row.role_code !== persona.role || row.pharmacie_id !== pharmacyId)) {
        throw new Error("Un autre poste ou une autre pharmacie est déjà actif sur la fixture " + persona.key + ".");
      }
      const existing = active.find(row => row.role_code === persona.role && row.pharmacie_id === pharmacyId);
      if (persona.role === "caisse") {
        // Idempotent: also repairs a pre-existing active Caisse assignment
        // if the physical pharmacy register was never provisioned.
        const provisioned = await rpc("naxa_provision_caisse", promoter.token, {
          p_target: fixtures[persona.key].id,
          p_pharmacie: pharmacyId,
        });
        if (!provisioned.ok) {
          throw new Error("Provisionnement Caisse refusé (HTTP " + provisioned.status + ").");
        }
      } else if (persona.role === "pharmacien") {
        const accreditationRows = await restAdmin(
          "naxa_pharmacien_accreditations?select=id,status,assignment_id,valid_until"
            + "&profile_id=eq." + encodeURIComponent(fixtures[persona.key].id)
            + "&pharmacie_id=eq." + encodeURIComponent(pharmacyId)
            + "&limit=10"
        );
        if (!Array.isArray(accreditationRows)) throw new Error("Lecture du dossier Pharmacien impossible.");
        const approved = accreditationRows.find(row =>
          row.status === "approved_promoteur" && row.assignment_id === existing?.id
          && (!row.valid_until || new Date(row.valid_until + "T23:59:59Z").getTime() >= Date.now())
        );
        if (!approved) {
          const objectPath = promoter.id + "/" + fixtures.pharmacien.id + "/" + pharmacyId + "/credential-e2e.pdf";
          await uploadPharmacistCredential(promoter.token, objectPath);
          const proposed = await rpc("naxa_proposer_accreditation_pharmacien", promoter.token, {
            p_target: fixtures.pharmacien.id,
            p_pharmacie: pharmacyId,
            p_registration_number: "E2E-TEST-" + fixtures.pharmacien.id.slice(0, 8),
            p_issuing_authority: "NAXA Replay - justificatif fictif de recette",
            p_specialty: "Pharmacie",
            p_credential_storage_path: objectPath,
            p_valid_until: "2099-12-31",
            p_motif: "Compte Pharmacien fictif exclusivement destiné à la recette Replay.",
          });
          if (!proposed.ok || typeof proposed.data !== "string") {
            throw new Error("Proposition Pharmacien par le Promoteur refusée (HTTP " + proposed.status + ").");
          }
          const decision = await rpc("naxa_promoteur_decider_accreditation_pharmacien", promoter.token, {
            p_accreditation: proposed.data,
            p_decision: "approve",
            p_note: "Validation fictive de recette Replay ; justificatif non réglementaire.",
          });
          if (!decision.ok || typeof decision.data !== "string") {
            throw new Error("Validation Pharmacien par le Promoteur refusée (HTTP " + decision.status + ").");
          }
        }
      } else if (!existing) {
        const provisioned = await rpc("naxa_grant_professional_assignment", promoter.token, {
          p_target: fixtures[persona.key].id,
          p_pharmacie: pharmacyId,
          p_fonction: persona.role,
          p_commence_at: new Date().toISOString(),
          p_expire_at: null,
          p_motif: "Affectation professionnelle E2E Replay du " + persona.role + ".",
        });
        if (!provisioned.ok) {
          throw new Error("Affectation " + persona.role + " refusée (HTTP " + provisioned.status + ").");
        }
      }
    }

    const accountantWrite = await rpc("compta_promoteur_configurer_ecriture", promoter.token, {
      p_pharmacie: pharmacyId,
      p_comptable: fixtures.comptable.id,
      p_autorise: true,
    });
    if (!accountantWrite.ok) {
      throw new Error("Délégation comptable explicite par le Promoteur refusée (HTTP " + accountantWrite.status + ").");
    }
    const accountantList = await rpc("compta_promoteur_lister_comptables", promoter.token, {
      p_pharmacie: pharmacyId,
    });
    if (!accountantList.ok || !Array.isArray(accountantList.data)
      || !accountantList.data.some(row => row.comptable_id === fixtures.comptable.id && row.ecriture_autorisee === true)) {
      throw new Error("Le Promoteur ne retrouve pas son Comptable avec le droit d'écriture délégué.");
    }

    const cashRegisters = await restAdmin(
      "caisses?select=id,nom,pharmacie_id,actif&pharmacie_id=eq."
        + encodeURIComponent(pharmacyId) + "&actif=eq.true&limit=10"
    );
    if (!Array.isArray(cashRegisters) || cashRegisters.length !== 1) {
      throw new Error("Le provisionnement Caisse devait créer exactement une ressource physique active.");
    }

    const results = [];
    for (const persona of PERSONAS) {
      const session = await login(persona.email, fixtures[persona.key].password, persona.key);
      if (session.id !== fixtures[persona.key].id) throw new Error("Identité Auth incohérente pour " + persona.key + ".");
      if (persona.role !== "client") {
        const selected = await rpc("naxa_select_active_role", session.token, {
          p_role_code: persona.role,
          p_pharmacie_id: pharmacyId,
        });
        if (!selected.ok || selected.data !== true) {
          throw new Error("Sélection du poste " + persona.role + " refusée (HTTP " + selected.status + ").");
        }
      }
      const role = await rpc("naxa_business_function", session.token, {});
      const activePharmacy = await rpc("naxa_active_role_pharmacy", session.token, {});
      if (!role.ok || role.data !== persona.role
        || (persona.role === "client" ? activePharmacy.data !== null : activePharmacy.data !== pharmacyId)) {
        throw new Error("Contexte actif invalide pour " + persona.key + ".");
      }
      if (persona.role === "caisse") {
        const visible = await request(
          "/rest/v1/caisses?select=id,nom,pharmacie_id&pharmacie_id=eq."
            + encodeURIComponent(pharmacyId) + "&actif=eq.true",
          { accessToken: session.token }
        );
        if (!visible.ok || !Array.isArray(visible.data) || visible.data.length !== 1) {
          throw new Error("Le compte Caisse ne voit pas sa ressource physique via RLS (HTTP " + visible.status + ").");
        }
      }
      if (persona.role === "gestionnaire_stock") {
        const assignment = await rpc("naxa_has_active_professional_assignment", session.token, {
          p_profile: session.id,
          p_pharmacie: pharmacyId,
          p_fonction: "gestionnaire_stock",
        });
        if (!assignment.ok || assignment.data !== true) {
          throw new Error("La RPC serveur ne confirme pas l'affectation Gestionnaire Stock active (HTTP " + assignment.status + ").");
        }
        const visible = await request(
          "/rest/v1/stocks?select=pharmacie_id,produit_id,quantite&pharmacie_id=eq."
            + encodeURIComponent(pharmacyId) + "&limit=1",
          { accessToken: session.token }
        );
        if (!visible.ok) {
          throw new Error("Le Gestionnaire Stock ne peut pas lire le stock autorisé via RLS (HTTP " + visible.status + ").");
        }
      }
      results.push({ persona: persona.key, role: persona.role, profileId: session.id });
    }


    // Véritable recette Client → Storage privé → Pharmacien → décision.
    const prescriptionClient = await login(
      "naxa.e2e.client-acheteur@example.invalid", fixtures.client.password, "Client ordonnance E2E"
    );
    const prescriptionPharmacist = await login(
      "naxa.e2e.pharmacien@example.invalid", fixtures.pharmacien.password, "Pharmacien ordonnance E2E"
    );
    const clientBusinessRole = await rpc("naxa_business_function", prescriptionClient.token, {});
    if (!clientBusinessRole.ok || clientBusinessRole.data !== "client") {
      throw new Error("Le compte de dépôt n'est pas dans l'espace Client.");
    }
    const selectedPharmacist = await rpc("naxa_select_active_role", prescriptionPharmacist.token, {
      p_role_code: "pharmacien", p_pharmacie_id: pharmacyId,
    });
    const pharmacistBusinessRole = await rpc("naxa_business_function", prescriptionPharmacist.token, {});
    const pharmacistActivePharmacy = await rpc("naxa_active_role_pharmacy", prescriptionPharmacist.token, {});
    if (!selectedPharmacist.ok || selectedPharmacist.data !== true
      || !pharmacistBusinessRole.ok || pharmacistBusinessRole.data !== "pharmacien"
      || !pharmacistActivePharmacy.ok || pharmacistActivePharmacy.data !== pharmacyId) {
      throw new Error("Le Pharmacien n'a pas de contexte actif sur la pharmacie E2E.");
    }

    const prescriptionNonce = randomBytes(12).toString("hex");
    const prescriptionObjectPath = buildClientPrescriptionObjectPath(
      prescriptionClient.id, pharmacyId, prescriptionNonce
    );
    const encodedPrescriptionPath = prescriptionObjectPath.split("/").map(encodeURIComponent).join("/");
    const prescriptionPdf = buildTestCredentialPdf();
    let prescriptionUploaded = false;
    let submittedPrescriptionId = null;
    let prescriptionPrimaryError = null;
    try {
      const upload = await fetch(
        baseUrl + "/storage/v1/object/naxa-client-prescriptions/" + encodedPrescriptionPath,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: "Bearer " + prescriptionClient.token,
            "Content-Type": "application/pdf",
            "x-upsert": "false",
          },
          body: prescriptionPdf,
        }
      );
      if (!upload.ok) {
        throw new Error("Upload ordonnance Client refusé (HTTP " + upload.status + ").");
      }
      prescriptionUploaded = true;
      process.stdout.write("PASS — upload PDF réel dans naxa-client-prescriptions par le Client authentifié.\n");

      const submitted = await rpc("naxa_client_soumettre_ordonnance", prescriptionClient.token, {
        p_pharmacie: pharmacyId,
        p_document_path: prescriptionObjectPath,
        p_note: "Document fictif de recette E2E Replay ; ne constitue pas une ordonnance médicale.",
      });
      if (!submitted.ok || typeof submitted.data !== "string" || !submitted.data) {
        throw new Error("Soumission Client de l'ordonnance refusée (HTTP " + submitted.status + ").");
      }
      submittedPrescriptionId = submitted.data;
      process.stdout.write("PASS — soumission Client via RPC métier et dossier en attente créé.\n");

      const clientRead = await request(
        "/rest/v1/prescriptions?select=id,client_id,pharmacie_id,source,document_ref,statut&id=eq."
          + encodeURIComponent(submittedPrescriptionId),
        { accessToken: prescriptionClient.token }
      );
      if (!clientRead.ok || !Array.isArray(clientRead.data) || clientRead.data.length !== 1
        || clientRead.data[0].client_id !== prescriptionClient.id
        || clientRead.data[0].pharmacie_id !== pharmacyId
        || clientRead.data[0].source !== "client"
        || clientRead.data[0].document_ref !== prescriptionObjectPath
        || clientRead.data[0].statut !== "en_attente") {
        throw new Error("Le Client ne relit pas son dossier d'ordonnance via RLS.");
      }
      process.stdout.write("PASS — lecture RLS de son ordonnance par le Client propriétaire.\n");

      const pharmacistRead = await request(
        "/rest/v1/prescriptions?select=id,client_id,pharmacie_id,source,document_ref,statut&id=eq."
          + encodeURIComponent(submittedPrescriptionId),
        { accessToken: prescriptionPharmacist.token }
      );
      if (!pharmacistRead.ok || !Array.isArray(pharmacistRead.data) || pharmacistRead.data.length !== 1
        || pharmacistRead.data[0].document_ref !== prescriptionObjectPath
        || pharmacistRead.data[0].statut !== "en_attente") {
        throw new Error("Le Pharmacien affecté ne lit pas l'ordonnance Client via RLS (HTTP "
          + pharmacistRead.status + ").");
      }
      process.stdout.write("PASS — lecture RLS de l'ordonnance reçue par le Pharmacien affecté.\n");

      const download = await fetch(
        baseUrl + "/storage/v1/object/authenticated/naxa-client-prescriptions/" + encodedPrescriptionPath,
        {
          headers: {
            apikey: anonKey,
            Authorization: "Bearer " + prescriptionPharmacist.token,
          },
        }
      );
      if (!download.ok) throw new Error("Téléchargement Pharmacien refusé (HTTP " + download.status + ").");
      const downloadedBytes = Buffer.from(await download.arrayBuffer());
      if (!downloadedBytes.equals(prescriptionPdf)) {
        throw new Error("Le PDF téléchargé par le Pharmacien diffère du fichier déposé.");
      }
      process.stdout.write("PASS — téléchargement du document original privé par le Pharmacien, octet par octet.\n");

      const decision = await rpc("prescription_valider", prescriptionPharmacist.token, {
        p_prescription: submittedPrescriptionId, p_accepter: true, p_motif: null,
      });
      if (!decision.ok || decision.data !== "validee") {
        throw new Error("Décision Pharmacien d'acceptation refusée (HTTP " + decision.status + ").");
      }
      const finalPrescription = await restAdmin(
        "prescriptions?select=id,statut,validateur_id,document_ref&id=eq."
          + encodeURIComponent(submittedPrescriptionId) + "&limit=2"
      );
      if (!Array.isArray(finalPrescription) || finalPrescription.length !== 1
        || finalPrescription[0].statut !== "validee"
        || finalPrescription[0].validateur_id !== prescriptionPharmacist.id
        || finalPrescription[0].document_ref !== prescriptionObjectPath) {
        throw new Error("La validation Pharmacien n'est pas persistée avec le bon validateur.");
      }
      process.stdout.write("PASS — décision Pharmacien et identité du validateur vérifiées côté serveur.\n");
    } catch (error) {
      prescriptionPrimaryError = error;
      throw error;
    } finally {
      const prescriptionCleanupErrors = [];
      if (submittedPrescriptionId) {
        const id = encodeURIComponent(submittedPrescriptionId);
        const pharmacy = encodeURIComponent(pharmacyId);
        for (const [endpoint, label] of [
          ["/rest/v1/prescription_preparations?prescription_id=eq." + id, "préparations"],
          ["/rest/v1/prescription_items?prescription_id=eq." + id, "lignes"],
          ["/rest/v1/prescriptions?id=eq." + id, "ordonnance"],
        ]) {
          try { await adminRequest(endpoint, "DELETE"); }
          catch (error) { prescriptionCleanupErrors.push(label + " : " + (error?.message || "erreur inconnue")); }
        }
      }
      if (prescriptionUploaded) {
        try {
          await adminRequest("/storage/v1/object/naxa-client-prescriptions", "DELETE", {
            prefixes: [prescriptionObjectPath],
          });
        } catch (error) {
          prescriptionCleanupErrors.push("objet Storage : " + (error?.message || "erreur inconnue"));
        }
      }
      if (submittedPrescriptionId) {
        try {
          const remaining = await restAdmin(
            "prescriptions?select=id&id=eq." + encodeURIComponent(submittedPrescriptionId) + "&limit=2"
          );
          if (remaining.length) prescriptionCleanupErrors.push("ordonnance toujours présente après nettoyage");
        } catch (error) { prescriptionCleanupErrors.push(error?.message || "vérification de nettoyage impossible"); }
      }
      if (prescriptionCleanupErrors.length) {
        const message = "Nettoyage ordonnance E2E incomplet : " + prescriptionCleanupErrors.join(" ; ");
        if (prescriptionPrimaryError) process.stderr.write(message + "\n");
        else throw new Error(message);
      }
      if (!prescriptionCleanupErrors.length) {
        process.stdout.write("PASS — nettoyage vérifié de l'ordonnance, ses lignes et son objet Storage ; l'événement d'audit métier immuable est conservé comme preuve.\n");
      }
    }

    const courierPasswordFile = String(env.NAXA_STORAGE_E2E_LIVREUR_PASSWORD_FILE || "").trim();
    if (!courierPasswordFile || !fs.existsSync(courierPasswordFile)) {
      throw new Error("Fichier secret du Livreur créé par le parcours d'invitation absent.");
    }
    const courierPassword = fs.readFileSync(courierPasswordFile, "utf8");
    if (!courierPassword) throw new Error("Secret Livreur vide.");
    const courier = await login("naxa.e2e.livreur@example.invalid", courierPassword, "livreur");
    const courierAssignment = await rpc("naxa_has_active_professional_assignment", courier.token, {
      p_profile: courier.id,
      p_pharmacie: pharmacyId,
      p_fonction: "livreur",
    });
    if (!courierAssignment.ok || courierAssignment.data !== true) {
      throw new Error("L'affectation Livreur issue de l'invitation n'est pas active sur la pharmacie cible.");
    }
    const courierRole = await rpc("naxa_select_active_role", courier.token, {
      p_role_code: "livreur",
      p_pharmacie_id: pharmacyId,
    });
    const courierBusinessRole = await rpc("naxa_business_function", courier.token, {});
    const courierActivePharmacy = await rpc("naxa_active_role_pharmacy", courier.token, {});
    if (!courierRole.ok || courierRole.data !== true
      || !courierBusinessRole.ok || courierBusinessRole.data !== "livreur"
      || !courierActivePharmacy.ok || courierActivePharmacy.data !== pharmacyId) {
      throw new Error("Le compte Livreur ne résout pas son espace métier et sa pharmacie active.");
    }

    const serviceRows = await restAdmin(
      "gestionnaire_stock_sessions?select=id,ended_at&user_id=eq." + encodeURIComponent(fixtures.stock.id) + "&limit=10"
    );
    const cashSessions = await restAdmin(
      "caisses_sessions?select=id,statut,cloture_at&ouvert_par=eq." + encodeURIComponent(fixtures.caisse.id) + "&limit=10"
    );
    if (!Array.isArray(serviceRows) || serviceRows.some(row => row.ended_at === null)) {
      throw new Error("Une session Stock de test reste ouverte ; contrôle de nettoyage requis.");
    }
    if (!Array.isArray(cashSessions) || cashSessions.some(row => row.statut === "ouverte")) {
      throw new Error("Une session Caisse de test reste ouverte ; aucune caisse ne devait être ouverte.");
    }

    process.stdout.write("PASS — 5 identités Replay vérifiées : Gestionnaire Stock, Caisse, Client, Comptable et Pharmacien.\n");
    process.stdout.write("PASS — Comptable affecté par le Promoteur ; Pharmacien proposé puis validé par le Promoteur avec justificatif fictif E2E.\n");
    process.stdout.write("PASS — les cinq profils se connectent et résolvent leur poste actif sur la pharmacie attendue.\n");
    process.stdout.write("PASS — affectations Stock/Caisse/Comptabilité actives, Comptable délégué en écriture par le Promoteur.\n");
    process.stdout.write("PASS — une Caisse physique active créée et visible par son compte via RLS.\n");
    process.stdout.write("PASS — lecture RLS du stock par le Gestionnaire Stock ; aucune quantité, réservation, vente ou mission modifiée.\n");
    process.stdout.write("PASS — Pharmacien approuvé par le Promoteur, dossier E2E fictif lié au profil et à la pharmacie.\n");
    process.stdout.write("PASS — Livreur issu du parcours invitation : affectation active, connexion réelle et rôle/pharmacie actifs vérifiés par JWT.\n");
    process.stdout.write("PASS — aucune session Stock ou Caisse ouverte par ce harnais.\n");
    process.stdout.write("INFO — comptes E2E conservés sur Replay ; aucun mot de passe n'est écrit dans les journaux.\n");
    process.stdout.write("RESULT=" + JSON.stringify(results.map(row => ({ persona: row.persona, role: row.role })) ) + "\n");
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    const cleanupErrors = [];
    for (const token of [...new Set(roleSessions)].reverse()) {
      try { await logout(token); }
      catch (error) { cleanupErrors.push(error?.message || "erreur inconnue"); }
    }
    if (cleanupErrors.length) {
      const message = "CLEANUP sessions Promoteur/équipe E2E : " + cleanupErrors.join(" ; ");
      if (failed) process.stderr.write(message + "\n");
      else throw new Error(message);
    }
  }
}

if (require.main === module) {
  provision().catch(error => {
    process.stderr.write("PROVISIONNEMENT ÉQUIPE PHARMACIE E2E BLOQUÉ — " + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl, buildMetadata, assertFixture, generateEphemeralPassword, buildTestCredentialPdf, buildClientPrescriptionObjectPath, PERSONAS };
