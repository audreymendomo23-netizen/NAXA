#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { randomBytes } = require("node:crypto");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const DIRECTOR = {
  email: "naxa.e2e.exam-director@example.invalid",
  username: "naxa_e2e_exam_director",
  phone: "+237600000088",
};
const FIXTURE_MARKER = "NAXA-E2E-EXAM-DIRECTOR-20261120";
const PARTNER_NAME = "NAXA — Centre d'examens E2E Replay";
const STAFF_ROLES = [
  "accueil",
  "caissier",
  "comptable",
  "technicien_laboratoire",
  "biologiste",
  "manipulateur_imagerie",
  "radiologue",
  "responsable_qualite",
  "responsable_securite",
];
const EXAM_SECURITY_STAFF = {
  username: "naxa_e2e_exam_security",
  email: "naxa.e2e.exam-security@example.invalid",
  phone: "+237600000087",
  firstName: "Compte",
  lastName: "Responsable Sécurité Centre E2E",
  role_key: "responsable_securite",
  fixturePersona: "exam_security",
};
const STAFF_FIXTURE_MARKER = "NAXA-E2E-EXAM-STAFF-20261120";
const STAFF = [
  { username: "naxa_e2e_acheteur", email: "naxa.e2e.client-acheteur@example.invalid", role_key: "accueil", invite: true },
  { username: "naxa_e2e_caisse", email: "naxa.e2e.caisse@example.invalid", role_key: "caissier" },
  { username: "naxa_e2e_comptable", email: "naxa.e2e.comptable@example.invalid", role_key: "comptable" },
  { username: "naxa_e2e_stock", email: "naxa.e2e.stock@example.invalid", role_key: "technicien_laboratoire" },
  { username: "naxa_e2e_pharmacien", email: "naxa.e2e.pharmacien@example.invalid", role_key: "biologiste" },
  { username: "naxa_e2e_livreur", email: "naxa.e2e.livreur@example.invalid", role_key: "manipulateur_imagerie" },
  { username: "naxa_e2e_expiry_stock", email: "naxa.e2e.expiry-stock@example.invalid", role_key: "radiologue" },
  { username: "naxa_e2e_expiry_responsable", email: "naxa.e2e.expiry-responsable@example.invalid", role_key: "responsable_qualite" },
  EXAM_SECURITY_STAFF,
];

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : cette recette est strictement limitée au projet Replay " + PROJECT_REF + ".");
  }
  return url.origin;
}

function buildDirectorMetadata() {
  return {
    username: DIRECTOR.username,
    first_name: "Compte",
    last_name: "Directeur Centre E2E",
    phone: DIRECTOR.phone,
    phone_country: "CM",
    date_of_birth: "1990-01-01",
    consent_accepted: true,
    naxa_signup_completed: true,
    naxa_signup_pending: false,
    naxa_e2e_fixture: FIXTURE_MARKER,
    naxa_e2e_persona: "exam_director",
  };
}

function buildStaffMetadata(staff) {
  return {
    username: staff.username,
    first_name: staff.firstName,
    last_name: staff.lastName,
    phone: staff.phone,
    phone_country: "CM",
    date_of_birth: "1990-01-01",
    consent_accepted: true,
    naxa_signup_completed: true,
    naxa_signup_pending: false,
    naxa_e2e_fixture: STAFF_FIXTURE_MARKER,
    naxa_e2e_persona: staff.fixturePersona,
  };
}

function assertStaffFixture(user, profile, staff) {
  if (!user || !profile) throw new Error("Fixture Auth/profil absente pour " + staff.username + ".");
  if (String(user.email || "").trim().toLowerCase() !== staff.email
    || !user.id || profile.id !== user.id || !user.email_confirmed_at) {
    throw new Error("Identité Auth confirmée et liée au profil requise pour " + staff.username + ".");
  }
  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  if (metadata.naxa_e2e_fixture !== STAFF_FIXTURE_MARKER
    || metadata.naxa_e2e_persona !== staff.fixturePersona
    || metadata.username !== staff.username
    || metadata.naxa_signup_completed !== true) {
    throw new Error("Marqueur Auth E2E absent ou incohérent pour " + staff.username + ".");
  }
  if (profile.role !== "client" || profile.actif !== true || profile.age_verified !== true
    || !profile.consent_accepted_at || profile.username !== staff.username
    || profile.first_name !== staff.firstName || profile.last_name !== staff.lastName
    || profile.phone !== staff.phone || !profile.date_of_birth) {
    throw new Error("Le profil du poste " + staff.role_key + " doit être un Client actif, majeur, consentant et complet.");
  }
  return true;
}

function assertDirectorFixture(user, profile) {
  if (!user || !profile) throw new Error("Fixture Auth/profil Directeur Centre absente.");
  if (String(user.email || "").trim().toLowerCase() !== DIRECTOR.email) {
    throw new Error("Adresse email différente de la fixture Directeur Centre.");
  }
  if (!user.id || profile.id !== user.id) throw new Error("Profil Directeur non lié à l'identité Auth.");
  if (!user.email_confirmed_at) throw new Error("L'adresse email Directeur doit être confirmée.");
  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  if (metadata.naxa_e2e_fixture !== FIXTURE_MARKER
    || metadata.naxa_e2e_persona !== "exam_director"
    || metadata.username !== DIRECTOR.username) {
    throw new Error("Marqueurs E2E Directeur absents ou incohérents.");
  }
  if (profile.role !== "client" || profile.actif !== true) {
    throw new Error("Le Directeur doit rester un compte Client actif ; aucune conversion/réactivation.");
  }
  if (profile.age_verified !== true || !profile.consent_accepted_at
    || !profile.date_of_birth || !profile.username || !profile.first_name
    || !profile.last_name || !profile.phone) {
    throw new Error("Profil Directeur non majeur, non consentant ou incomplet.");
  }
  return true;
}

function assertExamRoster(assignments, directorId) {
  const active = (assignments || []).filter(row =>
    row.is_active === true && row.active_role === true && row.revoked_at === null
  );
  if (active.length !== STAFF_ROLES.length) {
    throw new Error("La recette exige 9 postes actifs et distincts ; " + active.length + " observé(s).");
  }
  const roles = active.map(row => row.role_key);
  if (new Set(roles).size !== STAFF_ROLES.length
    || STAFF_ROLES.some(role => !roles.includes(role))) {
    throw new Error("La matrice des 9 postes du Centre est incomplète ou dupliquée.");
  }
  const users = active.map(row => row.user_id);
  if (new Set(users).size !== STAFF_ROLES.length || users.includes(directorId)) {
    throw new Error("Les 9 comptes du personnel doivent être distincts du Directeur.");
  }
  return true;
}

function required(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error("Configuration Replay manquante : " + label + ".");
  return text;
}

function readSecret(path, label) {
  const file = required(path, label);
  if (!fs.existsSync(file)) throw new Error("Fichier secret temporaire absent : " + label + ".");
  const value = fs.readFileSync(file, "utf8");
  if (!value) throw new Error("Fichier secret temporaire vide : " + label + ".");
  return value;
}

function generateEphemeralPassword() {
  return randomBytes(32).toString("base64url") + "Aa!9";
}

async function provision(env = process.env) {
  const baseUrl = assertReplayUrl(env.NAXA_STORAGE_E2E_URL || env.SUPABASE_URL);
  const anonKey = required(env.NAXA_STORAGE_E2E_ANON_KEY, "clé publique Replay");
  const adminKey = required(env.NAXA_STORAGE_E2E_ADMIN_KEY || env.SUPABASE_SERVICE_ROLE_KEY, "clé Admin Replay");
  const adminEmail = required(env.NAXA_STORAGE_E2E_ADMIN_EMAIL, "email Admin E2E");
  const adminPassword = readSecret(env.NAXA_STORAGE_E2E_ADMIN_PASSWORD_FILE, "Admin");
  const clientPassword = readSecret(env.NAXA_STORAGE_E2E_CLIENT_PASSWORD_FILE, "Client destinataire");
  if (!env.GITHUB_ENV || !env.RUNNER_TEMP) {
    throw new Error("Provisionnement autorisé uniquement dans GitHub Actions avec stockage temporaire.");
  }

  async function request(path, options = {}) {
    const admin = options.admin === true;
    const apiKey = admin ? adminKey : anonKey;
    const headers = { apikey: apiKey, "Content-Type": "application/json" };
    if (options.token) headers.Authorization = "Bearer " + options.token;
    else if (admin) headers.Authorization = "Bearer " + adminKey;
    else if (!anonKey.startsWith("sb_publishable_")) headers.Authorization = "Bearer " + anonKey;
    if (options.prefer) headers.Prefer = options.prefer;
    const response = await fetch(baseUrl + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok && options.allowFailure !== true) {
      const message = typeof data?.message === "string" ? data.message
        : typeof data?.error === "string" ? data.error : "requête refusée";
      throw new Error((options.label || path) + " : HTTP " + response.status + " — " + message.slice(0, 220));
    }
    return { ok: response.ok, status: response.status, data };
  }

  async function rows(path) {
    const result = await request("/rest/v1/" + path, { admin: true, label: "Contrôle admin Replay" });
    if (!Array.isArray(result.data)) throw new Error("Projection REST invalide pour " + path);
    return result.data;
  }

  async function rpc(name, token, args, options = {}) {
    const result = await request("/rest/v1/rpc/" + name, {
      method: "POST", token, body: args, label: "RPC " + name, allowFailure: options.allowFailure === true,
    });
    if (!result.ok && options.allowFailure !== true) {
      throw new Error("RPC " + name + " refusée (HTTP " + result.status + ").");
    }
    return result;
  }

  async function login(email, password, label) {
    const result = await request("/auth/v1/token?grant_type=password", {
      method: "POST", body: { email, password }, label: "Connexion Auth " + label,
    });
    if (!result.data?.access_token || !result.data?.user?.id) {
      throw new Error("Session Auth incomplète pour " + label + ".");
    }
    return { id: result.data.user.id, token: result.data.access_token };
  }

  async function findAuthUsers() {
    const all = [];
    for (let page = 1; page <= 20; page += 1) {
      const result = await request("/auth/v1/admin/users?page=" + page + "&per_page=50", {
        admin: true, label: "Lecture Auth paginée",
      });
      const users = Array.isArray(result.data?.users) ? result.data.users
        : Array.isArray(result.data?.data?.users) ? result.data.data.users
          : Array.isArray(result.data) ? result.data : [];
      all.push(...users);
      if (users.length < 50) break;
    }
    return all;
  }

  const authSessions = [];
  let primaryFailure = null;
  try {
    const directorPassword = generateEphemeralPassword();
    const authUsers = await findAuthUsers();
    const matches = authUsers.filter(user => String(user.email || "").trim().toLowerCase() === DIRECTOR.email);
    if (matches.length > 1) throw new Error("Plusieurs identités Auth portent l'email Directeur ; aucune conversion.");
    let directorAuth = matches[0] || null;

    if (directorAuth) {
      const profileRows = await rows("profiles?select=id,username,role,actif,age_verified,consent_accepted_at,date_of_birth,first_name,last_name,phone&id=eq."
        + encodeURIComponent(directorAuth.id) + "&limit=2");
      if (profileRows.length !== 1) throw new Error("Profil existant Directeur absent ou dupliqué.");
      assertDirectorFixture(directorAuth, profileRows[0]);
      await request("/auth/v1/admin/users/" + encodeURIComponent(directorAuth.id), {
        method: "PUT", admin: true, body: { password: directorPassword }, label: "Rotation secret fixture Directeur",
      });
    } else {
      const created = await request("/auth/v1/admin/users", {
        method: "POST", admin: true,
        body: {
          email: DIRECTOR.email,
          password: directorPassword,
          email_confirm: true,
          user_metadata: buildDirectorMetadata(),
        },
        label: "Création de la fixture Client Directeur Centre",
      });
      directorAuth = created.data?.user || created.data;
      if (!directorAuth?.id) throw new Error("Supabase Auth n'a pas retourné l'identité du Directeur.");
    }

    const directorPasswordFile = env.RUNNER_TEMP + "/naxa-e2e-exam-director-" + randomBytes(8).toString("hex") + ".secret";
    fs.writeFileSync(directorPasswordFile, directorPassword, { encoding: "utf8", flag: "wx", mode: 0o600 });
    fs.appendFileSync(env.GITHUB_ENV,
      "NAXA_STORAGE_E2E_EXAM_DIRECTOR_PASSWORD_FILE=" + directorPasswordFile + "\n",
      { encoding: "utf8", mode: 0o600 });

    let refreshedAuthUsers = await findAuthUsers();
    const refreshedMatches = refreshedAuthUsers.filter(user =>
      String(user.email || "").trim().toLowerCase() === DIRECTOR.email);
    if (refreshedMatches.length !== 1) throw new Error("Identité Directeur non unique après provisionnement.");
    directorAuth = refreshedMatches[0];
    const directorProfiles = await rows("profiles?select=id,username,role,actif,age_verified,consent_accepted_at,date_of_birth,first_name,last_name,phone&id=eq."
      + encodeURIComponent(directorAuth.id) + "&limit=2");
    if (directorProfiles.length !== 1) throw new Error("Le trigger Auth n'a pas créé le profil Directeur attendu.");
    assertDirectorFixture(directorAuth, directorProfiles[0]);

    const admin = await login(adminEmail, adminPassword, "Admin");
    authSessions.push(admin.token);
    const director = await login(DIRECTOR.email, directorPassword, "Directeur Centre");
    authSessions.push(director.token);

    // Create the pending Partner dossier through the real Admin RPC.
    // The RPC creates its independent exam_centers row and the partner-membership
    // trigger synchronizes the owner as Centre Director.
    let partnerRows = await rows("partners?select=id,name,partner_type,status,created_by&name=eq."
      + encodeURIComponent(PARTNER_NAME) + "&limit=3");
    if (partnerRows.length > 1) throw new Error("Plusieurs dossiers portent le nom de la fixture Centre.");
    let partner = partnerRows[0] || null;
    if (!partner) {
      const createdPartner = await rpc("admin_create_partner_dossier", admin.token, {
        p_owner_user_id: director.id,
        p_name: PARTNER_NAME,
        p_partner_type: "centre_examen",
        p_universe_slug: "examens",
        p_city: "Yaoundé",
        p_neighborhood: "Bastos",
        p_address: "Adresse technique de recette Replay",
        p_latitude: null,
        p_longitude: null,
        p_whatsapp: null,
        p_monthly_fee_fcfa: 10000,
        p_architecture_code: null,
        p_documents_received: { replay_fixture: true },
      }, { });
      const partnerId = typeof createdPartner.data === "string" ? createdPartner.data : createdPartner.data?.id;
      if (!partnerId) throw new Error("La RPC Admin n'a pas retourné l'identifiant du dossier Partenaire.");
      partnerRows = await rows("partners?select=id,name,partner_type,status,created_by&id=eq."
        + encodeURIComponent(partnerId) + "&limit=2");
      if (partnerRows.length !== 1) throw new Error("Dossier Partenaire absent après création Admin.");
      partner = partnerRows[0];
    }
    if (partner.partner_type !== "centre_examen" || partner.created_by !== admin.id
      || partner.name !== PARTNER_NAME) {
      throw new Error("Le dossier Replay existant ne correspond pas à la fixture Centre attendue.");
    }

    const dossierRows = await rows("admin_partner_dossiers?select=partner_id,promoteur_id,universe_slug,dossier_status&partner_id=eq."
      + encodeURIComponent(partner.id) + "&limit=2");
    if (dossierRows.length !== 1 || dossierRows[0].promoteur_id !== director.id
      || dossierRows[0].universe_slug !== "examens") {
      throw new Error("Le dossier Centre ne conserve pas son titulaire et son univers attendus.");
    }
    const centerRows = await rows("exam_centers?select=id,partner_id,display_name,status&partner_id=eq."
      + encodeURIComponent(partner.id) + "&limit=3");
    if (centerRows.length !== 1 || centerRows[0].status === "suspended") {
      throw new Error("Le RPC Admin doit créer exactement un Centre d'examens non suspendu.");
    }
    const center = centerRows[0];

    const directorAssignments = await rows("exam_staff_assignments?select=id,user_id,role_key,is_active,active_role,revoked_at&center_id=eq."
      + encodeURIComponent(center.id) + "&user_id=eq." + encodeURIComponent(director.id)
      + "&role_key=eq.directeur&limit=2");
    if (directorAssignments.length !== 1 || directorAssignments[0].is_active !== true
      || directorAssignments[0].active_role !== true || directorAssignments[0].revoked_at !== null) {
      throw new Error("Le déclencheur doit attribuer automatiquement le poste Directeur au titulaire du Partenaire.");
    }

    // Les huit comptes de personnel issus des cohortes Pharmacie/stock peuvent
    // être réutilisés. Le neuvième poste reçoit une identité Auth Client dédiée,
    // créée par l'Admin Replay seulement après contrôle d'unicité Auth/username/téléphone.
    const securityStaff = EXAM_SECURITY_STAFF;
    let securityMatches = refreshedAuthUsers.filter(user =>
      String(user.email || "").trim().toLowerCase() === securityStaff.email);
    if (securityMatches.length > 1) {
      throw new Error("Plusieurs identités Auth portent l'email du Responsable sécurité Centre.");
    }
    const securityUsernameRows = await rows("profiles?select=id,username&username=eq."
      + encodeURIComponent(securityStaff.username) + "&limit=2");
    const securityPhoneRows = await rows("profiles?select=id,phone&phone=eq."
      + encodeURIComponent(securityStaff.phone) + "&limit=2");
    if (securityMatches.length === 0) {
      if (securityUsernameRows.length || securityPhoneRows.length) {
        throw new Error("Username ou téléphone Responsable sécurité déjà rattaché à une autre identité ; création refusée.");
      }
      const securityPassword = generateEphemeralPassword();
      const createdSecurity = await request("/auth/v1/admin/users", {
        method: "POST",
        admin: true,
        body: {
          email: securityStaff.email,
          password: securityPassword,
          email_confirm: true,
          user_metadata: buildStaffMetadata(securityStaff),
        },
        label: "Création Auth du Client Responsable sécurité Centre Replay",
      });
      const securityAuth = createdSecurity.data?.user || createdSecurity.data;
      if (!securityAuth?.id) {
        throw new Error("Supabase Auth n'a pas retourné l'identité du Responsable sécurité Centre.");
      }
      const securityPasswordFile = env.RUNNER_TEMP + "/naxa-e2e-exam-security-"
        + randomBytes(8).toString("hex") + ".secret";
      fs.writeFileSync(securityPasswordFile, securityPassword, { encoding: "utf8", flag: "wx", mode: 0o600 });
      fs.appendFileSync(env.GITHUB_ENV,
        "NAXA_STORAGE_E2E_EXAM_SECURITY_PASSWORD_FILE=" + securityPasswordFile + "\\n",
        { encoding: "utf8", mode: 0o600 });
      refreshedAuthUsers = await findAuthUsers();
      securityMatches = refreshedAuthUsers.filter(user =>
        String(user.email || "").trim().toLowerCase() === securityStaff.email);
      process.stdout.write("PASS — identité Auth Client Responsable sécurité Centre créée et confirmée sur Replay.\\n");
    }
    if (securityMatches.length !== 1) {
      throw new Error("Identité Auth Responsable sécurité absente ou dupliquée après création.");
    }
    const securityAuth = securityMatches[0];
    const securityProfiles = await rows("profiles?select=id,username,role,actif,age_verified,consent_accepted_at,date_of_birth,first_name,last_name,phone&id=eq."
      + encodeURIComponent(securityAuth.id) + "&limit=2");
    if (securityProfiles.length !== 1) {
      throw new Error("Le trigger Auth n'a pas créé le profil Client Responsable sécurité attendu.");
    }
    assertStaffFixture(securityAuth, securityProfiles[0], securityStaff);
    if (securityUsernameRows.some(row => row.id !== securityAuth.id)
      || securityPhoneRows.some(row => row.id !== securityAuth.id)) {
      throw new Error("Username ou téléphone Responsable sécurité rattaché à une autre identité.");
    }

    const usernames = STAFF.map(item => item.username);
    const profiles = await rows("profiles?select=id,username,role,actif,age_verified,consent_accepted_at,date_of_birth,first_name,last_name,phone&username=in.("
      + usernames.join(",") + ")");
    if (profiles.length !== STAFF.length) {
      throw new Error("Les 9 profils Client attendus ne sont pas tous disponibles sur Replay après provisioning Auth.");
    }
    const usersByUsername = new Map(profiles.map(profile => [profile.username, profile]));
    const authByEmail = new Map(refreshedAuthUsers.map(user => [String(user.email || "").toLowerCase(), user]));
    for (const item of STAFF) {
      const profile = usersByUsername.get(item.username);
      const auth = authByEmail.get(item.email);
      if (item === securityStaff) {
        assertStaffFixture(auth, profile, securityStaff);
        continue;
      }
      if (!profile || !auth || profile.id !== auth.id || auth.email_confirmed_at == null
        || profile.role !== "client" || profile.actif !== true || profile.age_verified !== true
        || !profile.consent_accepted_at || !profile.date_of_birth || !profile.first_name
        || !profile.last_name || !profile.phone) {
        throw new Error("Le compte personnel " + item.username + " n'est pas un Client actif, confirmé et complet.");
      }
    }
    if (new Set(profiles.map(profile => profile.id)).size !== STAFF.length
      || profiles.some(profile => profile.id === director.id)) {
      throw new Error("Les comptes du personnel doivent être neuf identités distinctes du Directeur.");
    }

    // Invitation réelle acceptée par le compte destinataire, pour le poste Accueil.
    const invitee = STAFF.find(item => item.invite);
    const inviteeProfile = usersByUsername.get(invitee.username);
    let assignments = await rows("exam_staff_assignments?select=id,user_id,role_key,is_active,active_role,revoked_at&center_id=eq."
      + encodeURIComponent(center.id) + "&user_id=eq." + encodeURIComponent(inviteeProfile.id)
      + "&role_key=eq.accueil&limit=2");
    if (assignments.length === 0) {
      const tokenResult = await rpc("exam_create_staff_invite", director.token, {
        p_center_id: center.id, p_email: invitee.email, p_role_key: "accueil",
      });
      const inviteToken = tokenResult.data;
      if (typeof inviteToken !== "string" || !/^[0-9a-f-]{36}$/i.test(inviteToken)) {
        throw new Error("La création de l'invitation nominative n'a pas retourné de jeton valide.");
      }
      const client = await login(invitee.email, clientPassword, "Client destinataire de l'invitation Centre");
      authSessions.push(client.token);
      const acceptance = await rpc("exam_accept_staff_invite", client.token, { p_token: inviteToken });
      if (acceptance.data?.accepted !== true || acceptance.data?.center_id !== center.id
        || acceptance.data?.role_key !== "accueil") {
        throw new Error("Le compte destinataire n'a pas accepté sa propre invitation Centre.");
      }
      assignments = await rows("exam_staff_assignments?select=id,user_id,role_key,is_active,active_role,revoked_at&center_id=eq."
        + encodeURIComponent(center.id) + "&user_id=eq." + encodeURIComponent(inviteeProfile.id)
        + "&role_key=eq.accueil&limit=2");
      const inviteRows = await rows("exam_staff_invites?select=id,center_id,email,role_key,accepted_at,accepted_by,assignment_id&token=eq."
        + encodeURIComponent(inviteToken) + "&limit=2");
      if (inviteRows.length !== 1 || !inviteRows[0].accepted_at
        || inviteRows[0].accepted_by !== inviteeProfile.id || !inviteRows[0].assignment_id) {
        throw new Error("La preuve de l'invitation acceptée ne correspond pas au titulaire.");
      }
    }
    if (assignments.length !== 1 || assignments[0].is_active !== true
      || assignments[0].active_role !== true || assignments[0].revoked_at !== null) {
      throw new Error("Le poste Accueil issu de l'invitation n'est pas actif.");
    }

    // Eight direct assignments use the Centre Director's authenticated JWT.
    for (const item of STAFF.filter(entry => !entry.invite)) {
      const profile = usersByUsername.get(item.username);
      const current = await rows("exam_staff_assignments?select=id,user_id,role_key,is_active,active_role,revoked_at&center_id=eq."
        + encodeURIComponent(center.id) + "&user_id=eq." + encodeURIComponent(profile.id)
        + "&role_key=eq." + encodeURIComponent(item.role_key) + "&limit=2");
      if (current.length === 0) {
        const assigned = await rpc("exam_assign_existing_staff", director.token, {
          p_center_id: center.id, p_identifier: item.username, p_role_key: item.role_key,
        });
        if (assigned.data?.assigned !== true || assigned.data?.user_id !== profile.id
          || assigned.data?.center_id !== center.id || assigned.data?.role_key !== item.role_key) {
          throw new Error("Affectation directe non confirmée pour " + item.username + ".");
        }
      } else if (current.length !== 1 || current[0].is_active !== true
        || current[0].active_role !== true || current[0].revoked_at !== null) {
        throw new Error("Affectation préexistante incohérente pour " + item.username + ".");
      }
    }

    // A duplicate assignment must be rejected by the database guard.
    const duplicate = await rpc("exam_assign_existing_staff", director.token, {
      p_center_id: center.id,
      p_identifier: "naxa_e2e_stock",
      p_role_key: "technicien_laboratoire",
    }, { allowFailure: true });
    if (duplicate.ok) throw new Error("La RPC a accepté une affectation active dupliquée.");

    // Verify that an additional temporary role can be revoked without touching
    // the employee's primary active role.
    const stockProfile = usersByUsername.get("naxa_e2e_stock");
    const temporary = await rpc("exam_assign_existing_staff", director.token, {
      p_center_id: center.id, p_identifier: "naxa_e2e_stock", p_role_key: "radiologue",
    });
    const temporaryId = temporary.data?.assignment_id;
    if (typeof temporaryId !== "string") throw new Error("L'affectation temporaire n'a pas retourné d'identifiant.");
    const temporaryRow = await rows("exam_staff_assignments?select=id,user_id,role_key,is_active,active_role,revoked_at&id=eq."
      + encodeURIComponent(temporaryId) + "&limit=2");
    if (temporaryRow.length !== 1 || temporaryRow[0].active_role !== false
      || temporaryRow[0].user_id !== stockProfile.id) {
      throw new Error("Le poste additionnel d'un salarié ne doit pas devenir le rôle actif concurrent.");
    }
    const revoked = await rpc("exam_revoke_staff_assignment", director.token, {
      p_center_id: center.id, p_assignment_id: temporaryId,
    });
    if (revoked.data !== true) throw new Error("Révocation du poste temporaire refusée.");
    const revokedRows = await rows("exam_staff_assignments?select=id,is_active,active_role,revoked_at&id=eq."
      + encodeURIComponent(temporaryId) + "&limit=2");
    if (revokedRows.length !== 1 || revokedRows[0].is_active !== false
      || revokedRows[0].active_role !== false || !revokedRows[0].revoked_at) {
      throw new Error("La révocation du poste temporaire n'est pas persistée.");
    }

    // Pending invitation revocation is also exercised through the authenticated RPC.
    const revokedInviteToken = await rpc("exam_create_staff_invite", director.token, {
      p_center_id: center.id,
      p_email: "naxa.e2e.exam-revoked@example.invalid",
      p_role_key: "responsable_securite",
    });
    if (typeof revokedInviteToken.data !== "string") throw new Error("Jeton d'invitation révocable absent.");
    const pendingInvite = await rows("exam_staff_invites?select=id,token,revoked_at,accepted_at&token=eq."
      + encodeURIComponent(revokedInviteToken.data) + "&limit=2");
    if (pendingInvite.length !== 1 || pendingInvite[0].revoked_at || pendingInvite[0].accepted_at) {
      throw new Error("L'invitation de test n'est pas en attente avant révocation.");
    }
    const inviteRevoked = await rpc("exam_revoke_staff_invite", director.token, {
      p_center_id: center.id, p_invite_id: pendingInvite[0].id,
    });
    if (inviteRevoked.data !== true) throw new Error("Révocation de l'invitation en attente refusée.");
    const revokedInviteRows = await rows("exam_staff_invites?select=id,revoked_at,accepted_at&id=eq."
      + encodeURIComponent(pendingInvite[0].id) + "&limit=2");
    if (revokedInviteRows.length !== 1 || !revokedInviteRows[0].revoked_at
      || revokedInviteRows[0].accepted_at) {
      throw new Error("La révocation de l'invitation n'est pas persistée.");
    }

    const finalAssignments = await rows("exam_staff_assignments?select=id,user_id,role_key,is_active,active_role,revoked_at&center_id=eq."
      + encodeURIComponent(center.id) + "&is_active=eq.true&revoked_at=is.null");
    const directorFinal = finalAssignments.filter(row => row.role_key === "directeur"
      && row.user_id === director.id && row.active_role === true);
    if (directorFinal.length !== 1) throw new Error("Le Directeur actif doit rester unique pour cette identité.");
    assertExamRoster(finalAssignments.filter(row => row.role_key !== "directeur"), director.id);

    const finalPartner = await rows("partners?select=id,status,partner_type&id=eq."
      + encodeURIComponent(partner.id) + "&limit=2");
    const finalDossier = await rows("admin_partner_dossiers?select=partner_id,dossier_status&partner_id=eq."
      + encodeURIComponent(partner.id) + "&limit=2");
    const finalUniverse = await rows("partner_universes?select=partner_id,universe_slug,enabled&partner_id=eq."
      + encodeURIComponent(partner.id) + "&universe_slug=eq.examens&limit=2");
    if (finalPartner.length !== 1 || finalPartner[0].status !== "pending"
      || finalDossier.length !== 1 || finalDossier[0].dossier_status !== "pending"
      || finalUniverse.length !== 1 || finalUniverse[0].enabled !== false) {
      throw new Error("La recette ne doit pas activer artificiellement le Partenaire, le dossier ou l'univers.");
    }

    process.stdout.write("PASS — dossier Partenaire Centre créé par la RPC Admin Replay ; identité titulaire distincte et inchangée Client.\n");
    process.stdout.write("PASS — centre d'examens créé par le parcours métier et poste Directeur synchronisé automatiquement.\n");
    process.stdout.write("PASS — 9 comptes Client distincts affectés aux 9 postes : un par invitation acceptée, huit en affectation directe.\n");
    process.stdout.write("PASS — l'affectation dupliquée est refusée ; un poste supplémentaire est désactivé et sa révocation auditée.\n");
    process.stdout.write("PASS — invitation nominative en attente révoquée par le Directeur via RPC.\n");
    process.stdout.write("PASS — Partenaire/dossier/Univers restent pending/disabled ; aucune activation ni confirmation de paiement fictive.\n");
    process.stdout.write("RESULT — center_id=" + center.id + " ; partner_id=" + partner.id + " ; staff=9 ; director=1.\n");
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    for (const token of [...new Set(authSessions)].reverse()) {
      await request("/auth/v1/logout?scope=local", {
        method: "POST", token, label: "Déconnexion session fixture Centre",
      }).catch(error => {
        if (primaryFailure) process.stderr.write("CLEANUP SESSION CENTRE — " + error.message + "\n");
        else primaryFailure = error;
      });
    }
  }
  if (primaryFailure) throw primaryFailure;
}

if (require.main === module) {
  provision().catch(error => {
    process.stderr.write("RECETTE PERSONNEL CENTRE EXAMENS BLOQUÉE — "
      + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = {
  assertReplayUrl,
  buildDirectorMetadata,
  assertDirectorFixture,
  assertExamRoster,
  STAFF_ROLES,
  STAFF,
  EXAM_SECURITY_STAFF,
  buildStaffMetadata,
  assertStaffFixture,
  provision,
};
