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
  const seedBalance = 1000;
  const plans = [
    { channel: "especes", amount: 100, suffix: "ESPECES", verify: false },
    { channel: "orange_money", amount: 200, suffix: "ORANGE", verify: true },
    { channel: "mtn_momo", amount: 300, suffix: "MTN", verify: true },
  ];
  const sessions = [];
  const operationIds = [];
  const treasuryAccountIds = [];
  const referenceByChannel = Object.fromEntries(plans.map(plan => [plan.channel, marker + "-" + plan.suffix]));
  const attemptedReferences = [
    ...plans.map(plan => referenceByChannel[plan.channel]),
    marker + "-ORANGE-SANS-PREUVE",
    marker + "-MTN-SANS-COMPTE",
    marker + "-DEPASSEMENT",
  ];
  const idempotencyByChannel = Object.fromEntries(plans.map(plan => [plan.channel, crypto.randomUUID()]));
  const treasuryAccountByChannel = {};
  let promoterToken = null;
  let cashierToken = null;
  let creditId = null;
  let cashierSessionId = null;
  let clientId = null;
  let clientFicheExisted = false;
  let sessionClosed = false;
  let mainError = null;

  async function call(path, options = {}) {
    const admin = options.admin === true;
    const headers = {
      apikey: admin ? adminKey : anonKey,
      "Content-Type": "application/json",
    };
    if (options.token) headers.Authorization = "Bearer " + options.token;
    else if (admin) {
      if (!adminKey.startsWith("sb_secret_")) headers.Authorization = "Bearer " + adminKey;
    } else if (!anonKey.startsWith("sb_publishable_")) {
      headers.Authorization = "Bearer " + anonKey;
    }
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

  function inFilter(ids) {
    return "in.(" + [...new Set(ids)].join(",") + ")";
  }

  async function findOperationsByReferences() {
    const found = [];
    for (const reference of attemptedReferences) {
      const rows = await adminRows(
        "client_credit_operations?select=id,reference&reference=eq."
          + encodeURIComponent(reference) + "&limit=2"
      );
      found.push(...rows);
    }
    return [...new Map(found.map(row => [row.id, row])).values()];
  }

  async function closeSessionSafely() {
    if (!cashierSessionId || sessionClosed || !cashierToken) return;
    const rows = await adminRows(
      "client_credit_operations?select=montant&caisse_session_id=eq."
        + encodeURIComponent(cashierSessionId)
        + "&nature=eq.remboursement&mode_paiement=eq.especes"
    ).catch(() => []);
    const physicalCashRefunds = rows.reduce((sum, row) => sum + Number(row.montant || 0), 0);
    const closed = await rpc("caisse_cloturer", cashierToken, {
      p_session: cashierSessionId, p_total_compte: physicalCashRefunds,
    }, "Clôture de la session E2E");
    const row = Array.isArray(closed) ? closed[0] : closed;
    if (!row || Number(row.total_theorique) !== physicalCashRefunds || Number(row.ecart) !== 0) {
      throw new Error("La clôture Caisse n'est pas rapprochée au montant espèces uniquement.");
    }
    sessionClosed = true;
  }

  async function cleanup() {
    const errors = [];
    let discoveryComplete = !clientId;
    if (clientId) {
      try {
        operationIds.push(...(await findOperationsByReferences()).map(row => row.id));
        discoveryComplete = true;
      } catch (error) {
        errors.push("Découverte des opérations de nettoyage impossible : " + error.message);
      }
    }

    let operationsDeleted = discoveryComplete;
    for (const id of [...new Set(operationIds)]) {
      let movementsDeleted = false;
      try {
        await call("/rest/v1/tresorerie_mouvements?source_type=eq.credit_remboursement&source_id=eq."
          + encodeURIComponent(id), {
          admin: true, method: "DELETE", prefer: "return=minimal", label: "Nettoyage mouvement trésorerie temporaire",
        });
        movementsDeleted = true;
      } catch (error) { errors.push(error.message); }
      if (!movementsDeleted) { operationsDeleted = false; continue; }

      let operationDeleted = false;
      try {
        await call("/rest/v1/client_credit_operations?id=eq." + encodeURIComponent(id), {
          admin: true, method: "DELETE", prefer: "return=minimal", label: "Nettoyage opération crédit",
        });
        operationDeleted = true;
      } catch (error) { errors.push(error.message); }
      if (!operationDeleted) { operationsDeleted = false; continue; }

      try {
        await call("/rest/v1/compta_evenement?source_type=eq.credit_operation&source_id=eq."
          + encodeURIComponent(id) + "&evenement_type=eq.credit_remboursement", {
          admin: true, method: "DELETE", prefer: "return=minimal", label: "Nettoyage outbox crédit",
        });
      } catch (error) { errors.push(error.message); }
    }

    if (operationsDeleted && creditId) {
      try {
        await call("/rest/v1/client_credits?id=eq." + encodeURIComponent(creditId), {
          admin: true, method: "DELETE", prefer: "return=minimal", label: "Nettoyage compte crédit E2E",
        });
      } catch (error) { errors.push(error.message); }
    }
    if (operationsDeleted && !clientFicheExisted && clientId) {
      try {
        await call("/rest/v1/client_fiches?client_id=eq."
          + encodeURIComponent(clientId) + "&pharmacie_id=eq." + encodeURIComponent(pharmacyId), {
          admin: true, method: "DELETE", prefer: "return=minimal", label: "Nettoyage fiche Client E2E",
        });
      } catch (error) { errors.push(error.message); }
    }

    if (cashierSessionId && !sessionClosed) {
      try { await closeSessionSafely(); }
      catch (error) { errors.push(error.message); }
    }

    if (operationsDeleted) {
      for (const id of [...new Set(treasuryAccountIds)]) {
        try {
          await call("/rest/v1/tresorerie_comptes?id=eq." + encodeURIComponent(id), {
            admin: true, method: "DELETE", prefer: "return=minimal", label: "Nettoyage compte trésorerie E2E",
          });
        } catch (error) { errors.push(error.message); }
      }
    }

    if (operationsDeleted && clientId && attemptedReferences.length) {
      try {
        const remainingOps = await findOperationsByReferences();
        if (remainingOps.length) errors.push("Des opérations de remboursement subsistent après nettoyage.");
      } catch (error) { errors.push(error.message); }
      try {
        const remainingMovements = await adminRows(
          "tresorerie_mouvements?select=id&source_type=eq.credit_remboursement&reference=in."
            + "(" + attemptedReferences.map(value => '"' + value.replace(/"/g, "") + '"').join(",") + ")&limit=20"
        );
        if (remainingMovements.length) errors.push("Des mouvements de trésorerie E2E subsistent après nettoyage.");
      } catch (error) { errors.push(error.message); }
      if (operationIds.length) {
        try {
          const remainingEvents = await adminRows(
            "compta_evenement?select=id&source_type=eq.credit_operation&evenement_type=eq.credit_remboursement&source_id=in."
              + "(" + [...new Set(operationIds)].map(value => '"' + value + '"').join(",") + ")&limit=20"
          );
          if (remainingEvents.length) errors.push("Des événements comptables E2E subsistent après nettoyage.");
        } catch (error) { errors.push(error.message); }
      }
    }
    if (operationsDeleted && creditId) {
      try {
        const remainingCredits = await adminRows(
          "client_credits?select=id&id=eq." + encodeURIComponent(creditId) + "&limit=2"
        );
        if (remainingCredits.length) errors.push("Le compte crédit E2E subsiste après nettoyage.");
      } catch (error) { errors.push(error.message); }
    }
    if (operationsDeleted && treasuryAccountIds.length) {
      try {
        const remainingAccounts = await adminRows(
          "tresorerie_comptes?select=id&id=in.(" + [...new Set(treasuryAccountIds)].join(",") + ")&limit=10"
        );
        if (remainingAccounts.length) errors.push("Des comptes trésorerie E2E subsistent après nettoyage.");
      } catch (error) { errors.push(error.message); }
    }
    if (cashierSessionId && sessionClosed) {
      try {
        const closedRows = await adminRows(
          "caisses_sessions?select=id,statut,total_theorique,total_compte,ecart&id=eq."
            + encodeURIComponent(cashierSessionId) + "&limit=1"
        );
        const row = closedRows[0];
        if (!row || row.statut !== "cloturee" || Number(row.total_theorique) !== 0
          || Number(row.total_compte) !== 0 || Number(row.ecart) !== 0) {
          errors.push("La session Caisse E2E doit être clôturée à zéro après nettoyage des fixtures.");
        }
      } catch (error) { errors.push(error.message); }
    }

    for (const token of [...new Set(sessions)].reverse()) {
      try {
        await call("/auth/v1/logout?scope=local", { method: "POST", token, label: "Fermeture session E2E" });
      } catch (error) { errors.push(error.message); }
    }
    return errors;
  }

  try {
    const promoter = await login(PROMOTER_EMAIL, promoterPassword, "Promoteur");
    promoterToken = promoter.token;
    const cashier = await login(CASHIER_EMAIL, cashierPassword, "Caisse");
    cashierToken = cashier.token;
    const client = await login(CLIENT_EMAIL, clientPassword, "Client");
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

    const existingTreasuryMappings = [];
    for (const plan of plans) {
      const rows = await adminRows(
        "tresorerie_comptes?select=id,canal_paiement&pharmacie_id=eq."
          + encodeURIComponent(pharmacyId) + "&canal_paiement=eq."
          + encodeURIComponent(plan.channel) + "&actif=eq.true&limit=2"
      );
      existingTreasuryMappings.push(...rows);
    }
    if (existingTreasuryMappings.length) {
      throw new Error("Des comptes de trésorerie existent déjà pour un canal de la pharmacie E2E ; la recette ne les réaffecte ni ne les supprime.");
    }

    for (const plan of plans) {
      const id = await rpc("caisse_credit_tresorerie_compte_creer", cashierToken, {
        p_pharmacie: pharmacyId, p_canal: plan.channel,
      }, "Création compte trésorerie " + plan.channel);
      if (typeof id !== "string") throw new Error("Compte de trésorerie non créé pour " + plan.channel + ".");
      treasuryAccountByChannel[plan.channel] = id;
      treasuryAccountIds.push(id);
      const retryId = await rpc("caisse_credit_tresorerie_compte_creer", cashierToken, {
        p_pharmacie: pharmacyId, p_canal: plan.channel,
      }, "Vérification idempotence compte " + plan.channel);
      if (retryId !== id) throw new Error("Création compte non idempotente pour " + plan.channel + ".");
    }

    const listedAccounts = await rpc("caisse_credit_tresorerie_comptes_lister", cashierToken, {
      p_pharmacie: pharmacyId,
    }, "Lecture comptes trésorerie Caisse");
    if (!Array.isArray(listedAccounts)
      || plans.some(plan => !listedAccounts.some(row => row.canal_paiement === plan.channel
        && row.account_id === treasuryAccountByChannel[plan.channel]))) {
      throw new Error("La Caisse ne retrouve pas ses trois comptes de règlement distincts.");
    }

    creditId = await rpc("client_credit_configurer", promoterToken, {
      p_client: clientId, p_pharmacie: pharmacyId, p_plafond: 10000,
    }, "Création du compte crédit test");
    if (typeof creditId !== "string") throw new Error("La configuration Promoteur n'a pas retourné d'identifiant de compte crédit.");

    await call("/rest/v1/client_credits?id=eq." + encodeURIComponent(creditId), {
      admin: true, method: "PATCH", body: { solde: seedBalance },
      prefer: "return=minimal", label: "Préparation du solde technique Replay",
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
      throw new Error("Le solde initial technique du compte crédit ne correspond pas à la fixture Replay.");
    }

    const refunds = [];
    for (const plan of plans) {
      const reference = referenceByChannel[plan.channel];
      const idempotencyKey = idempotencyByChannel[plan.channel];
      const args = {
        p_credit: creditId,
        p_montant: plan.amount,
        p_mode: plan.channel,
        p_reference: reference,
        p_motif: "Recette E2E technique Replay — " + plan.channel,
        p_idempotency_key: idempotencyKey,
        p_verification_beneficiaire: plan.verify,
        p_verification_montant: plan.verify,
        p_confirmation_client_vue: plan.verify,
      };
      const id = await rpc("client_credit_rembourser", cashierToken, args,
        "Remboursement authentifié " + plan.channel);
      if (typeof id !== "string") throw new Error("Le remboursement " + plan.channel + " n'a pas retourné d'identifiant.");
      operationIds.push(id);
      const replayedId = await rpc("client_credit_rembourser", cashierToken, args,
        "Rejeu idempotent " + plan.channel);
      if (replayedId !== id) throw new Error("Le rejeu " + plan.channel + " a créé une seconde opération.");
      refunds.push({ ...plan, reference, id, idempotencyKey });
    }

    let idempotencyConflictRejected = false;
    try {
      await rpc("client_credit_rembourser", cashierToken, {
        p_credit: creditId, p_montant: 101, p_mode: "especes",
        p_reference: referenceByChannel.especes,
        p_motif: "Recette E2E technique Replay — especes",
        p_idempotency_key: idempotencyByChannel.especes,
        p_verification_beneficiaire: false,
        p_verification_montant: false,
        p_confirmation_client_vue: false,
      }, "Refus d'une clé idempotence avec payload différent");
    } catch { idempotencyConflictRejected = true; }
    if (!idempotencyConflictRejected) throw new Error("Une clé idempotence réutilisée avec un montant différent a été acceptée.");

    let missingProofRejected = false;
    try {
      await rpc("client_credit_rembourser", cashierToken, {
        p_credit: creditId, p_montant: 50, p_mode: "orange_money",
        p_reference: marker + "-ORANGE-SANS-PREUVE",
        p_motif: "Contrôle preuve mobile incomplète",
        p_idempotency_key: crypto.randomUUID(),
        p_verification_beneficiaire: false,
        p_verification_montant: true,
        p_confirmation_client_vue: true,
      }, "Refus preuve Orange incomplète");
    } catch { missingProofRejected = true; }
    if (!missingProofRejected) throw new Error("Orange Money a été accepté sans contrôle visuel complet.");

    await rpc("caisse_credit_tresorerie_canal_configurer", cashierToken, {
      p_pharmacie: pharmacyId, p_canal: "mtn_momo", p_compte: null,
    }, "Retrait temporaire mapping MTN pour test négatif");
    let missingAccountRejected = false;
    try {
      await rpc("client_credit_rembourser", cashierToken, {
        p_credit: creditId, p_montant: 50, p_mode: "mtn_momo",
        p_reference: marker + "-MTN-SANS-COMPTE",
        p_motif: "Contrôle compte MTN absent",
        p_idempotency_key: crypto.randomUUID(),
        p_verification_beneficiaire: true,
        p_verification_montant: true,
        p_confirmation_client_vue: true,
      }, "Refus compte MTN non configuré");
    } catch { missingAccountRejected = true; }
    await rpc("caisse_credit_tresorerie_canal_configurer", cashierToken, {
      p_pharmacie: pharmacyId, p_canal: "mtn_momo", p_compte: treasuryAccountByChannel.mtn_momo,
    }, "Rétablissement mapping MTN");
    if (!missingAccountRejected) throw new Error("MTN MoMo a été accepté sans compte de trésorerie affecté.");

    let balanceExceededRejected = false;
    try {
      await rpc("client_credit_rembourser", cashierToken, {
        p_credit: creditId, p_montant: seedBalance, p_mode: "especes",
        p_reference: marker + "-DEPASSEMENT",
        p_motif: "Contrôle dépassement solde",
        p_idempotency_key: crypto.randomUUID(),
        p_verification_beneficiaire: false,
        p_verification_montant: false,
        p_confirmation_client_vue: false,
      }, "Refus remboursement supérieur au solde");
    } catch { balanceExceededRejected = true; }
    if (!balanceExceededRejected) throw new Error("Un remboursement supérieur au solde restant a été accepté.");

    const expectedBalance = seedBalance - plans.reduce((sum, plan) => sum + plan.amount, 0);
    const after = await adminRows(
      "client_credits?select=solde&id=eq." + encodeURIComponent(creditId) + "&limit=1"
    );
    if (after.length !== 1 || Number(after[0].solde) !== expectedBalance) {
      throw new Error("Le solde final n'est pas égal à 400 FCFA après les trois canaux et les refus.");
    }

    const idsFilter = inFilter(operationIds);
    const operations = await adminRows(
      "client_credit_operations?select=id,nature,montant,mode_paiement,caisse_session_id,created_by,reference,verification_beneficiaire,verification_montant,confirmation_client_vue,verification_effectuee_par,verification_effectuee_at"
        + "&id=" + idsFilter + "&limit=10"
    );
    if (operations.length !== 3) throw new Error("La base ne contient pas exactement trois opérations uniques.");
    for (const refund of refunds) {
      const op = operations.find(row => row.id === refund.id);
      if (!op || op.nature !== "remboursement" || Number(op.montant) !== refund.amount
        || op.mode_paiement !== refund.channel || op.caisse_session_id !== cashierSessionId
        || op.created_by !== cashier.id || op.reference !== refund.reference) {
        throw new Error("L'opération " + refund.channel + " n'est pas liée au client, au caissier et à la session Caisse.");
      }
      if (refund.verify && (op.verification_beneficiaire !== true || op.verification_montant !== true
        || op.confirmation_client_vue !== true || op.verification_effectuee_par !== cashier.id
        || !op.verification_effectuee_at)) {
        throw new Error("Les preuves visuelles " + refund.channel + " ne sont pas persistées.");
      }
    }

    const movements = await adminRows(
      "tresorerie_mouvements?select=id,compte_id,nature,montant,source_type,source_id,canal_paiement,origine"
        + "&source_type=eq.credit_remboursement&source_id=" + idsFilter + "&limit=10"
    );
    if (movements.length !== 3) throw new Error("La trésorerie doit contenir exactement un mouvement par opération.");
    for (const refund of refunds) {
      const movement = movements.find(row => row.source_id === refund.id);
      if (!movement || movement.compte_id !== treasuryAccountByChannel[refund.channel]
        || Number(movement.montant) !== refund.amount || movement.nature !== "encaissement"
        || movement.canal_paiement !== refund.channel || movement.origine !== "comptoir") {
        throw new Error("Le mouvement trésorerie " + refund.channel + " est absent ou mal rapproché.");
      }
    }

    const events = await adminRows(
      "compta_evenement?select=id,evenement_type,source_type,source_id,donnees"
        + "&source_type=eq.credit_operation&source_id=" + idsFilter
        + "&evenement_type=eq.credit_remboursement&limit=10"
    );
    if (events.length !== 3 || events.some(event => event.source_type !== "credit_operation"
      || event.evenement_type !== "credit_remboursement"
      || !operationIds.includes(event.source_id))) {
      throw new Error("L'outbox comptable doit émettre exactement un événement par remboursement.");
    }
    for (const refund of refunds) {
      const event = events.find(row => row.source_id === refund.id);
      if (!event || event.donnees?.montant_fcfa !== String(refund.amount)) {
        throw new Error("L'événement comptable du canal " + refund.channel + " ne reflète pas son montant.");
      }
    }

    const sessionRefundRows = await adminRows(
      "client_credit_operations?select=montant&caisse_session_id=eq."
        + encodeURIComponent(cashierSessionId) + "&nature=eq.remboursement"
    );
    const totalAllRefunds = sessionRefundRows.reduce((sum, row) => sum + Number(row.montant || 0), 0);
    const cashRows = await adminRows(
      "client_credit_operations?select=montant&caisse_session_id=eq."
        + encodeURIComponent(cashierSessionId) + "&nature=eq.remboursement&mode_paiement=eq.especes"
    );
    const cashDrawerTotal = cashRows.reduce((sum, row) => sum + Number(row.montant || 0), 0);
    if (totalAllRefunds !== 600 || cashDrawerTotal !== 100) {
      throw new Error("La session doit distinguer 600 FCFA remboursés au total, dont 100 FCFA seulement en espèces.");
    }

    process.stdout.write("PASS — JWT Caisse Replay : remboursement espèces, Orange Money et MTN MoMo authentifiés.\n");
    process.stdout.write("PASS — solde client : 1 000 → 400 FCFA ; 3 opérations et 3 mouvements trésorerie, sans double débit.\n");
    process.stdout.write("PASS — une écriture par canal : compte associé, nature encaissement, origine comptoir et outbox comptable unique.\n");
    process.stdout.write("PASS — rejouabilité des trois clés ; conflit de payload, preuve mobile absente, compte absent et dépassement refusés sans débit.\n");
    process.stdout.write("PASS — session Caisse : 600 FCFA remboursés, dont 100 FCFA en espèces comptabilisées au tiroir.\n");
    process.stdout.write("INFO — le solde initial a été préchargé uniquement par le service Replay ; aucune vente ni créance commerciale n'est simulée.\n");
  } catch (error) {
    mainError = error;
  } finally {
    const errors = await cleanup();
    if (errors.length) {
      const message = "NETTOYAGE E2E INCOMPLET — " + errors.join(" ; ");
      if (mainError) process.stderr.write(message + "\n");
      else mainError = new Error(message);
    }
  }

  if (mainError) throw mainError;
  return true;
}

if (require.main === module) {
  run().catch(error => {
    process.stderr.write("CREDIT REFUND MULTICHANNEL E2E BLOQUÉ — " + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl, run };
