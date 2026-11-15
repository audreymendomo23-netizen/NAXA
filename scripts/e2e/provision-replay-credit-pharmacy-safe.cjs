#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const PHARMACY_ID = "1a4f1ce5-cccf-477e-9a5b-474c8c9fc713";
const PROMOTER_EMAIL = "naxa.e2e.promoteur@example.invalid";
const STOCK_EMAIL = "naxa.e2e.expiry-stock@example.invalid";
const PRODUCT = {
  nom: "NAXA E2E — Produit crédit comptoir",
  dci: "NAXA E2E",
  dosage: "1 unité",
  forme: "Unité",
  prix: 1000,
  emplacement: "Réserve interne de recette",
};

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error("Configuration manquante : " + label + ".");
  return result;
}

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : la fixture crédit est strictement limitée à Replay.");
  }
  return url.origin;
}

function readSecret(path, label) {
  const file = required(path, label);
  if (!fs.existsSync(file)) throw new Error("Fichier secret absent pour " + label + ".");
  const value = fs.readFileSync(file, "utf8");
  if (!value) throw new Error("Fichier secret vide pour " + label + ".");
  return value;
}

async function run(env = process.env) {
  const baseUrl = assertReplayUrl(env.SUPABASE_URL || env.NAXA_STORAGE_E2E_URL);
  const anonKey = required(env.NAXA_STORAGE_E2E_ANON_KEY, "clé anonyme Replay");
  const adminKey = required(env.NAXA_STORAGE_E2E_ADMIN_KEY, "clé Admin Replay");
  const promoterPassword = readSecret(env.NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD_FILE, "Promoteur");
  const stockPassword = readSecret(env.NAXA_STORAGE_E2E_EXPIRY_STOCK_PASSWORD_FILE, "Gestionnaire Stock");
  if (!env.GITHUB_ENV) throw new Error("Provisionnement autorisé uniquement dans GitHub Actions.");

  const tokens = [];
  let promoterId = null;
  let stockId = null;
  let productId = null;

  async function call(path, options = {}) {
    const admin = options.admin === true;
    const apiKey = admin ? adminKey : anonKey;
    const headers = { apikey: apiKey, "Content-Type": "application/json" };
    if (options.token) headers.Authorization = "Bearer " + options.token;
    else if (admin && !adminKey.startsWith("sb_secret_")) headers.Authorization = "Bearer " + adminKey;
    else if (!admin && !anonKey.startsWith("sb_publishable_")) headers.Authorization = "Bearer " + anonKey;
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
      const detail = typeof data?.message === "string" ? data.message : "requête refusée";
      throw new Error((options.label || path) + " : HTTP " + response.status + " — " + detail.slice(0, 220));
    }
    return data;
  }

  async function login(email, password, label) {
    const auth = await call("/auth/v1/token?grant_type=password", {
      method: "POST", body: { email, password }, label: "Connexion " + label,
    });
    if (!auth?.access_token || !auth?.user?.id) throw new Error("Session Auth invalide pour " + label + ".");
    tokens.push(auth.access_token);
    return { id: auth.user.id, token: auth.access_token };
  }

  async function rpc(name, token, args) {
    return call("/rest/v1/rpc/" + name, {
      method: "POST", token, body: args, label: "RPC " + name,
    });
  }

  async function rows(path) {
    const result = await call("/rest/v1/" + path, { admin: true, label: "Lecture de contrôle Replay" });
    if (!Array.isArray(result)) throw new Error("Réponse REST inattendue.");
    return result;
  }

  try {
    const promoter = await login(PROMOTER_EMAIL, promoterPassword, "Promoteur");
    promoterId = promoter.id;
    const stock = await login(STOCK_EMAIL, stockPassword, "Gestionnaire Stock");
    stockId = stock.id;

    const pharmacies = await rows(
      "pharmacies?select=id,actif,archivee_le,visible_recherche,est_demo&id=eq."
        + encodeURIComponent(PHARMACY_ID) + "&limit=1"
    );
    if (pharmacies.length !== 1 || pharmacies[0].actif !== true
      || pharmacies[0].archivee_le !== null || pharmacies[0].visible_recherche !== false
      || pharmacies[0].est_demo !== false) {
      throw new Error("La pharmacie de recette doit rester active, non archivée, non-démo et masquée.");
    }

    const links = await rows(
      "promoteur_pharmacies?select=pharmacie_id,actif&promoteur_id=eq."
        + encodeURIComponent(promoterId) + "&pharmacie_id=eq."
        + encodeURIComponent(PHARMACY_ID) + "&actif=eq.true&limit=2"
    );
    if (links.length !== 1) throw new Error("La pharmacie technique n'appartient pas au réseau Promoteur connecté.");

    const stockProfiles = await rows(
      "profiles?select=id,role,actif,fonction_interne,username&id=eq."
        + encodeURIComponent(stockId) + "&limit=1"
    );
    if (stockProfiles.length !== 1 || stockProfiles[0].actif !== true
      || stockProfiles[0].fonction_interne !== "gestionnaire_stock") {
      throw new Error("Le compte Stock cible n'est pas un Gestionnaire Stock actif.");
    }

    await rpc("naxa_provision_caisse", promoter.token, {
      p_target: stockId, p_pharmacie: PHARMACY_ID,
    });

    const assignments = await rows(
      "naxa_professional_assignments?select=id,role_code,statut,pharmacie_id"
        + "&profile_id=eq." + encodeURIComponent(stockId)
        + "&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
        + "&role_code=eq.caisse&statut=eq.active&limit=2"
    );
    const registers = await rows(
      "caisses?select=id,pharmacie_id,actif&pharmacie_id=eq."
        + encodeURIComponent(PHARMACY_ID) + "&actif=eq.true&limit=2"
    );
    if (assignments.length !== 1 || registers.length !== 1) {
      throw new Error("Le Promoteur n'a pas provisionné exactement une affectation et une Caisse physique active.");
    }

    await rpc("naxa_select_active_role", stock.token, {
      p_role_code: "gestionnaire_stock", p_pharmacie_id: PHARMACY_ID,
    });

    const declaredProduct = await rpc("pharmacie_produit_declarer_et_reference_initialiser", stock.token, {
      p_pharmacie: PHARMACY_ID,
      p_nom: PRODUCT.nom,
      p_dci: PRODUCT.dci,
      p_dosage: PRODUCT.dosage,
      p_forme: PRODUCT.forme,
      p_prix: PRODUCT.prix,
      p_emplacement: PRODUCT.emplacement,
      p_code_barre: null,
      p_sur_ordonnance: false,
    });
    if (typeof declaredProduct !== "string") throw new Error("La déclaration de produit pharmacie n'a pas retourné d'identifiant.");
    productId = declaredProduct;

    const stockRows = await rows(
      "stocks?select=pharmacie_id,produit_id,prix,quantite"
        + "&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
        + "&produit_id=eq." + encodeURIComponent(productId) + "&limit=2"
    );
    if (stockRows.length !== 1 || Number(stockRows[0].prix) !== PRODUCT.prix) {
      throw new Error("La référence Stock propriétaire n'a pas été initialisée correctement.");
    }

    const lots = await rows(
      "stocks_lots?select=id&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
        + "&produit_id=eq." + encodeURIComponent(productId) + "&limit=1"
    );
    if (lots.length) throw new Error("Le produit technique doit rester hors lot pour cette recette POS ciblée.");

    const targetQuantity = 4;
    const currentQuantity = Number(stockRows[0].quantite);
    const delta = targetQuantity - currentQuantity;
    if (delta !== 0) {
      await rpc("gestionnaire_stock_quantite_ajuster", stock.token, {
        p_pharmacie: PHARMACY_ID,
        p_produit: productId,
        p_delta: delta,
        p_type: "ajustement",
        p_motif: "Fixture technique masquée pour recette E2E crédit POS",
        p_lot: null,
      });
    }

    const verified = await rows(
      "stocks?select=prix,quantite&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
        + "&produit_id=eq." + encodeURIComponent(productId) + "&limit=1"
    );
    if (verified.length !== 1 || Number(verified[0].quantite) !== targetQuantity) {
      throw new Error("Le stock technique n'est pas à la quantité cible de quatre unités.");
    }

    fs.appendFileSync(env.GITHUB_ENV,
      "NAXA_STORAGE_E2E_CREDIT_PHARMACY_ID=" + PHARMACY_ID + "\n"
        + "NAXA_STORAGE_E2E_CREDIT_PRODUCT_ID=" + productId + "\n"
        + "NAXA_STORAGE_E2E_CREDIT_CASHIER_USER_ID=" + stockId + "\n",
      { encoding: "utf8", mode: 0o600 }
    );

    process.stdout.write("PASS — Caisse technique provisionnée par le Promoteur sur la pharmacie HYBRIDE masquée.\\n");
    process.stdout.write("PASS — Caisse et rôle Gestionnaire Stock sont attribués au même profil, utilisables séparément via sélection du rôle actif.\\n");
    process.stdout.write("PASS — fiche propriétaire et référence Stock initialisées par les RPC pharmacie/Stock, stock 4 unités, aucun lot.\\n");
    process.stdout.write("PASS — visibilité Marketplace de la pharmacie demeure false ; aucune offre publique créée.\\n");
  } finally {
    for (const token of [...new Set(tokens)].reverse()) {
      await call("/auth/v1/logout?scope=local", {
        method: "POST", token, label: "Déconnexion de la session de provisionnement",
      }).catch(() => null);
    }
  }
}

if (require.main === module) {
  run().catch(error => {
    process.stderr.write("PROVISIONNEMENT CRÉDIT E2E BLOQUÉ — " + (error?.message || "erreur inconnue") + "\\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl, run, PHARMACY_ID, PRODUCT };
