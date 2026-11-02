const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const action = read("src/app/admin/promoteurs/actions.ts");
const page = read("src/app/admin/pharmacies/[id]/page.tsx");
const migration = read("supabase/migrations/20261102114000_admin_pharmacy_receipt_checklist_informational.sql");
const contract = read("supabase/tests/20261029110000_admin_validate_dossier_pending_only.sql");

const validationAction = action.slice(
  action.indexOf("export async function validerDossierPharmacie"),
  action.indexOf("export async function suspendrePromoteurDisciplinaire")
);

test("les cases de réception restent modifiables mais ne bloquent pas la validation serveur", () => {
  assert.match(action, /export async function mettreAJourPiecesRecues/);
  assert.match(action, /from\("pharmacie_documents_recus"\)\.upsert/);
  assert.doesNotMatch(validationAction, /pharmacie_documents_recus|REQUIRED_RECEIPT_FIELDS|pieces-reception/);
  assert.match(validationAction, /REQUIRED_DOCUMENT_TYPES\.some/);
});

test("l'interface affiche la checklist comme informative et ne la combine pas aux prérequis", () => {
  assert.match(page, /db\.from\("pharmacie_documents_recus"\)/);
  assert.match(page, /Checklist informative/);
  assert.match(page, /const piecesCompletes=!controlePiecesIndisponible&&fichiersNonValides\.length===0/);
  assert.doesNotMatch(page, /declarationsManquantes\.length===0/);
});

test("la RPC additive conserve les gardes et les six fichiers réels sans lire les cases de réception", () => {
  assert.match(migration, /create or replace function public\.admin_valider_dossier_pharmacie/);
  assert.doesNotMatch(migration, /pharmacie_documents_recus|v_documents_recus/);
  assert.match(migration, /public\.is_admin\(\)/);
  assert.match(migration, /p_autorisations_verifiees is distinct from true/);
  assert.match(migration, /v_pharmacie\.actif is distinct from false/);
  assert.match(migration, /v_link\.actif is distinct from false/);
  assert.match(migration, /v_promoteur\.actif is distinct from false/);
  for (const type of ["existence_legale", "registre_commerce", "niu", "attestation_non_redevance", "plan_localisation", "cni_promoteur"]) {
    assert.ok(migration.includes("'" + type + "'"), "document requis absent : " + type);
  }
  assert.match(migration, /v_latest_document_status is distinct from 'valide'/);
});

test("le contrat SQL ne réintroduit pas de prérequis basé sur la checklist", () => {
  assert.match(contract, /Les cases de réception doivent rester informatives/);
  assert.match(contract, /Les dernières versions des six fichiers réels doivent toujours être validées/);
  assert.doesNotMatch(contract, /v_documents_recus\.kyc is distinct from true/);
});
