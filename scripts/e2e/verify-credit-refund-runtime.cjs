#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const PROMOTER_EMAIL = "naxa.e2e.promoteur@example.invalid";
const CASHIER_EMAIL = "naxa.e2e.caisse@example.invalid";
const CLIENT_EMAIL = "naxa.e2e.client-acheteur@example.invalid";
const REFERENCE_PREFIX = "NAXA-E2E-REFUND-";

function required(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error("Configuration E2E manquante : " + label + ".");
  return text;
}

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : le test remboursement est limité au projet Replay.");
  }
  return url.origin;
}

function readSecret(path, label) {
  const file = required(path, label);
  if (!fs.existsSync(file)) throw new Error("Fichier de secret absent pour " + label + ".");
  const value = fs.readFileSync(file, "utf8");
  if (!value) throw new Error("Fichier de secret vide pour " + label + ".");
  return value;
}

async function run(env = process.env) {
  const baseUrl = assertReplayUrl(env.SUPABASE_URL || env.NAXA_STORAGE_E2E_URL);
  const anonKey = required(env.NAXA_STORAGE_E2E_ANON_KEY, "clé anonyme Replay");
  const adminKey = required(env.NAXA_STORAGE_E2E_ADMIN_KEY, "clé Admin Replay");
  const pharmacyId = required(env.NAXA_STORAGE_E2E_PROMOTEUR_PHARMACY_ID, "pharmacie Replay");
  const promoterPassword = readSecret(env.NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD_FILE, "Promoteur");
  const cashierPassword = readSecret(env.NAXA_STORAGE_E2E_CAISSE_PASSWORD_FILE, "Caisse");
  const clientPassword = readSecret(env.NAXA_STORAGE_E2E_CLIENT_PASSWORD_FILE, "Client");

  const marker = REFERENCE_PREFIX + Date.now().toString(36).toUpperCase()
    + "-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const amount = 250;
  const seedBalance = 500;
  const sessions = [];
  let promoterToken = null;
  let cashierToken = null;
  let clientToken = null;
  let creditId = null;
  let cashierSessionId = null;
  let operationId = null;
  let clientFicheExisted = false;
  let sessionClosed = false;
  let mainError = null;

  async function call(path, options = {}) {
    const admin = options.admin === true;
    const token = options.token || (admin ? adminKey : null);
    const headers = {
      apikey: admin ? adminKey : anonKey,
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = "Bearer " + token;
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
    if (!response.ok) {
      const message = typeof data?.message === "string" ? data.message
        : typeof data?.hint === "string" ? data.hint : "requête refusée";
      throw new Error((options.label || path) + " : HTTP " + response.status + " — " + message.slice(0, 220));
    }
    return data;
  }

  async function login(email, password, label) {
    const data = await call("/auth/v1/token?grant_type=password", {
      method: "POST", body: { email, password }, label: "Connexion " + label,
    });
    if (!data?.access_token || !data?.user?.id) throw new Error("Jeton de session incomplet pour " + label + ".");
    sessions.push(data.access_token);
    return { id: data.user.id, token: data.access_token };
  }

  async function rpc(name, token, args, label) {
    return call("/rest/v1/rpc/" + name, {
      method: "POST", token, body: args, label: label || name,
    });
  }

  async function adminRows(path) {
    const rows = await call("/rest/v1/" + path, { admin: true, label: "Lecture technique Replay" });
    if (!Array.isArray(rows)) throw new Error("Projection REST inattendue.");
    return rows;
  }

  async function closeSessionSafely() {
    if (!cashierSessionId || sessionClosed || !cashierToken) return;
    const rows = await adminRows(
      "client_credit_operations?select=montant&caisse_session_id=eq."
        + encodeURIComponent(cashierSessionId) + "&nature=eq.remboursement"
    ).catch(() => []);
    const refundTotal = rows.reduce((sum, row) => sum + Number(row.montant || 0), 0);
    await rpc("caisse_cloturer", cashierToken, {
      p_session: cashierSessionId, p_total_compte: refundTotal,
    }, "Clôture de la session E2E")
      .then(() => { sessionClosed = true; })
      .catch(() => null);
  }

  async function cleanup() {
    const errors = [];
    if (cashierSessionId && !sessionClosed) await closeSessionSafely();

    if (operationId) {
      try {
        await call("/rest/v1/compta_evenement?source_type=eq.credit_operation&source_id=eq."
          + encodeURIComponent(operationId) + "&evenement_type=eq.credit_remboursement",
        { admin: true, method: "DELETE", prefer: "return=minimal", label: "Nettoyage outbox crédit" });
      } catch (error) { errors.push(error.message); }
      try {
        await call("/rest/v1/client_credit_operations?id=eq." + encodeURIComponent(operationId),
          { admin: true, method: "DELETE", prefer: "return=minimal", label: "Nettoyage opération crédit" });
      } catch (error) { errors.push(error.message); }
    }
    if (creditId) {
      try {
        await call("/rest/v1/client_credits?id=eq." + encodeURIComponent(creditId),
          { admin: true, method: "DELETE", prefer: "return=minimal", label: "Nettoyage compte crédit E2E" });
      } catch (error) { errors.push(error.message); }
    }
    if (!clientFicheExisted) {
      try {
        await call("/rest/v1/client_fiches?client_id=eq."
          + encodeURIComponent(clientId) + "&pharmacie_id=eq." + encodeURIComponent(pharmacyId),
        { admin: true, method: "DELETE", prefer: "return=minimal", label: "Nettoyage fiche Client E2E" });
      } catch (error) { errors.push(error.message); }
    }
    for (const token of [...new Set(sessions)].reverse()) {
      try {
        await call("/auth/v1/logout?scope=local", { method: "POST", token, label: "Fermeture session E2E" });
      } catch (error) { errors.push(error.message); }
    }
    return errors;
  }

  let clientId = null;
  try {
    const promoter = await login(PROMOTER_EMAIL, promoterPassword, "Promoteur");
    promoterToken = promoter.token;
    const cashier = await login(CASHIER_EMAIL, cashierPassword, "Caisse");
    cashierToken = cashier.token;
    const client = await login(CLIENT_EMAIL, clientPassword, "Client");
    clientToken = client.token;
    clientId = client.id;

    await rpc("naxa_select_active_role", promoterToken, {
      p_role_code: "promoteur", p_pharmacie_id: null,
    }, "Sélection du poste Promoteur");
    await rpc("naxa_select_active_role", cashierToken, {
      p_role_code: "caisse", p_pharmacie_id: pharmacyId,
    }, "Sélection du poste Caisse");

    const existingFiche = await adminRows(
      "client_fiches?select=client_id&client_id=eq." + encodeURIComponent(clientId)
        + "&pharmacie_id=eq." + encodeURIComponent(pharmacyId) + "&limit=1"
    );
    clientFicheExisted = existingFiche.length > 0;

    const existingCredits = await adminRows(
      "client_credits?select=id,solde&client_id=eq." + encodeURIComponent(clientId)
        + "&pharmacie_id=eq." + encodeURIComponent(pharmacyId) + "&limit=2"
    );
    if (existingCredits.length) {
      throw new Error("Le Client technique possède déjà un compte crédit dans cette pharmacie ; aucun encours existant ne sera modifié.");
    }

    creditId = await rpc("client_credit_configurer", promoterToken, {
      p_client: clientId, p_pharmacie: pharmacyId, p_plafond: 10000,
    }, "Création du compte crédit test");
    if (typeof creditId !== "string") throw new Error("La configuration Promoteur n'a pas retourné d'identifiant de compte crédit.");

    await call("/rest/v1/client_credits?id=eq." + encodeURIComponent(creditId), {
      admin: true, method: "PATCH", body: { solde: seedBalance },
      prefer: "return=minimal", label: "Préparation du solde technique de test",
    });

    const registers = await adminRows(
      "caisses?select=id,pharmacie_id,actif&pharmacie_id=eq."
        + encodeURIComponent(pharmacyId) + "&actif=eq.true&limit=5"
    );
    if (registers.length !== 1) throw new Error("Une seule Caisse physique active est requise pour la recette.");
    const openSessions = await adminRows(
      "caisses_sessions?select=id&caisse_id=eq." + encodeURIComponent(registers[0].id)
        + "&statut=eq.ouverte&limit=2"
    );
    if (openSessions.length) throw new Error("Une session Caisse existe déjà ; aucune session existante ne sera utilisée ni clôturée.");

    cashierSessionId = await rpc("caisse_ouvrir", cashierToken, {
      p_caisse: registers[0].id, p_fond_initial: 0,
    }, "Ouverture personnelle de la session Caisse");
    if (typeof cashierSessionId !== "string") throw new Error("La Caisse n'a pas ouvert une session identifiable.");

    const before = await adminRows(
      "client_credits?select=id,solde,plafond,actif&id=eq." + encodeURIComponent(creditId) + "&limit=1"
    );
    if (before.length !== 1 || Number(before[0].solde) !== seedBalance || before[0].actif !== true) {
      throw new Error("Le solde initial technique du compte crédit ne correspond pas à la fixture.");
    }

    operationId = await rpc("client_credit_rembourser", cashierToken, {
      p_credit: creditId, p_montant: amount, p_mode: "especes",
      p_reference: marker, p_motif: "Test runtime automatisé Replay ; sans créance commerciale",
    }, "Exécution authentifiée du RPC de remboursement");
    if (typeof operationId !== "string") throw new Error("Le remboursement n'a pas retourné un identifiant d'opération.");

    const after = await adminRows(
      "client_credits?select=solde&id=eq." + encodeURIComponent(creditId) + "&limit=1"
    );
    if (after.length !== 1 || Number(after[0].solde) !== seedBalance - amount) {
      throw new Error("Le solde Client n'a pas été diminué exactement du montant remboursé.");
    }

    const operations = await adminRows(
      "client_credit_operations?select=id,nature,montant,mode_paiement,caisse_session_id,created_by,reference"
        + "&id=eq." + encodeURIComponent(operationId) + "&limit=1"
    );
    const op = operations[0];
    if (!op || op.nature !== "remboursement" || Number(op.montant) !== amount
      || op.mode_paiement !== "especes" || op.caisse_session_id !== cashierSessionId
      || op.created_by !== cashier.id || op.reference !== marker) {
      throw new Error("L'opération de remboursement n'est pas correctement liée au compte, au titulaire et à la session de Caisse.");
    }

    const events = await adminRows(
      "compta_evenement?select=id,evenement_type,source_type,source_id,statut,donnees"
        + "&source_type=eq.credit_operation&source_id=eq." + encodeURIComponent(operationId)
        + "&evenement_type=eq.credit_remboursement&limit=2"
    );
    if (events.length !== 1 || events[0].source_id !== operationId
      || events[0].evenement_type !== "credit_remboursement"
      || events[0].source_type !== "credit_operation") {
      throw new Error("L'outbox comptable du remboursement n'a pas été émise une seule fois.");
    }

    let rejected = false;
    try {
      await rpc("client_credit_rembourser", cashierToken, {
        p_credit: creditId, p_montant: seedBalance, p_mode: "especes",
        p_reference: marker + "-OVER", p_motif: "Vérification de la borne supérieure",
      }, "Contrôle du dépassement de solde");
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("Un remboursement supérieur au solde restant a été accepté.");
    const afterRejected = await adminRows(
      "client_credits?select=solde&id=eq." + encodeURIComponent(creditId) + "&limit=1"
    );
    if (afterRejected.length !== 1 || Number(afterRejected[0].solde) !== seedBalance - amount) {
      throw new Error("Le refus du montant excessif a modifié le solde.");
    }

    const close = await rpc("caisse_cloturer", cashierToken, {
      p_session: cashierSessionId, p_total_compte: amount,
    }, "Rapprochement de caisse après remboursement");
    const closeRow = Array.isArray(close) ? close[0] : close;
    if (Number(closeRow?.total_theorique) !== amount || Number(closeRow?.ecart) !== 0) {
      throw new Error("Le remboursement n'a pas été intégré au rapprochement espèces de la session.");
    }
    sessionClosed = true;

    process.stdout.write("PASS — remboursement exécuté via JWT du compte Caisse Replay authentifié.\\n");
    process.stdout.write("PASS — solde diminué exactement de 250 FCFA ; opération espèces reliée à la session personnelle.\\n");
    process.stdout.write("PASS — outbox credit_remboursement émise une seule fois ; dépassement de solde refusé sans mutation.\\n");
    process.stdout.write("PASS — rapprochement de la session Caisse : espèces théoriques 250 FCFA, écart 0 ; session clôturée.\\n");
    process.stdout.write("INFO — le solde initial de 500 FCFA a été préchargé uniquement par le service Replay pour tester le RPC de remboursement ; ce test ne simule pas une vente ni une créance commerciale.\\n");
  } catch (error) {
    mainError = error;
  } finally {
    const errors = await cleanup();
    if (errors.length) {
      const message = "NETTOYAGE E2E INCOMPLET — " + errors.join(" ; ");
      if (mainError) process.stderr.write(message + "\\n");
      else mainError = new Error(message);
    }
  }

  if (mainError) throw mainError;
  return true;
}

if (require.main === module) {
  run().catch(error => {
    process.stderr.write("CREDIT REFUND RUNTIME E2E BLOQUÉ — " + (error?.message || "erreur inconnue") + "\\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl, run };
