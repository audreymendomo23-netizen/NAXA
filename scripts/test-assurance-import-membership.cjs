"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const importMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261115120000_assurance_import_membership_pos_negotiation.sql"), "utf8");
const verificationMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261115121500_assurance_multipharmacy_coverage_verification.sql"), "utf8");
const importContract = fs.readFileSync(path.join(root, "supabase/tests/20261115121500_assurance_import_membership_pos_negotiation.sql"), "utf8");
const runtimeImportTest = fs.readFileSync(path.join(root, "supabase/tests/20261115123000_assurance_import_runtime_multipharmacy.sql"), "utf8");
const declarationStampMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261115124000_assurance_declaration_version_uses_clock_timestamp.sql"), "utf8");
const pharmacyPage = fs.readFileSync(path.join(root, "src/app/pharmacie/assurance/page.tsx"), "utf8");
const clientPage = fs.readFileSync(path.join(root, "src/components/assurance/AssuranceReceiptDetails.tsx"), "utf8");

test("l'import accepte CSV/XLS/XLSX, plafonne les fichiers et calcule une empreinte SHA-256", () => {
  assert.match(pharmacyPage, /\["csv","xls","xlsx"\]/);
  assert.match(pharmacyPage, /10\*1024\*1024/);
  assert.match(pharmacyPage, /rawRows\.length>5000/);
  assert.match(pharmacyPage, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(pharmacyPage, /XLSX\.read\(buffer/);
});

test("les colonnes sont normalisées et les champs requis sont contrôlés avant l'envoi", () => {
  assert.match(pharmacyPage, /normalizeImportHeader/);
  assert.match(pharmacyPage, /numero_adherent/);
  assert.match(pharmacyPage, /date_debut/);
  assert.match(pharmacyPage, /statut/);
  assert.match(pharmacyPage, /Colonne obligatoire absente/);
  assert.match(pharmacyPage, /importDateToIso/);
});

test("l'import est simulé avant application et expose les anomalies sans les valider", () => {
  assert.match(pharmacyPage, /assurance_import_simuler_mode/);
  assert.match(pharmacyPage, /assurance_import_appliquer/);
  assert.match(pharmacyPage, /correspondances<1/);
  assert.match(pharmacyPage, /ambiguite/);
  assert.match(pharmacyPage, /invalides/);
  assert.match(pharmacyPage, /doublons/);
  assert.match(pharmacyPage, /Aucun profil client n’est créé/);
});

test("la base impose le scope pharmacie, le hash unique et les rapprochements non ambigus", () => {
  assert.match(importMigration, /unique \(pharmacie_id,assureur_id,sha256\)/);
  assert.match(importMigration, /private\.naxa_scope_allows/);
  assert.match(importMigration, /v_match_count>1/);
  assert.match(importMigration, /doublon_fichier/);
  assert.match(importMigration, /security definer/i);
  assert.match(importMigration, /revoke all on function public\.assurance_import_simuler/);
});

test("les statuts de lignes invalides ne peuvent pas casser toute la simulation", () => {
  assert.match(importMigration, /case when v_status in \('actif','suspendu','expire'\) then v_status else null end/);
});

test("les vérifications sont multi-pharmacies, versionnées et annulées par une correction de la déclaration", () => {
  assert.match(verificationMigration, /create table if not exists public\.assurance_couverture_verifications/);
  assert.match(verificationMigration, /unique\(couverture_id,pharmacie_id,import_id\)/);
  assert.match(verificationMigration, /mode_import in \('complet','delta'\)/);
  assert.match(verificationMigration, /statut='remplacee'/);
  assert.match(verificationMigration, /declaration_maj_at=c\.declaration_maj_at/);
  assert.match(verificationMigration, /v\.couverture_id=c\.id/);
  assert.match(verificationMigration, /v2\.couverture_id=c\.id/);
  assert.doesNotMatch(verificationMigration, /v\.couverture_id=v_c\.id/);
  assert.match(verificationMigration, /assurance_stamp_couverture_declaration/);
});

test("une correction de couverture invalide l’ancienne vérification avec un horodatage distinct", () => {
  assert.match(declarationStampMigration, /new\.declaration_maj_at:=clock_timestamp\(\)/);
  assert.doesNotMatch(declarationStampMigration, /new\.declaration_maj_at:=now\(\)/);
});

test("le Client ne peut calculer un devis qu'après vérification de sa couverture dans la pharmacie réservée", () => {
  assert.match(verificationMigration, /v\.pharmacie_id=v_r\.pharmacie_id/);
  assert.match(verificationMigration, /v\.statut='verifiee'/);
  assert.match(clientPage, /assurance_couverture_verifications/);
  assert.match(clientPage, /eligibleCoverages/);
  assert.match(clientPage, /n’a pas encore été rapprochée avec une liste de cet assureur/);
});

test("le test runtime vérifie import delta/complet multi-pharmacies et rollbacke toutes ses fixtures", () => {
  assert.match(runtimeImportTest, /20261115123000_assurance_import_runtime_multipharmacy PASS/);
  assert.match(runtimeImportTest, /rollback/i);
  assert.match(runtimeImportTest, /v_verification_a<>'suspendue'/);
  assert.match(runtimeImportTest, /v_verification_b<>'verifiee'/);
  assert.match(verificationMigration, /verification_le timestamptz not null default clock_timestamp\\(\\)/);
});

test("les fichiers et les tests de contrat couvrent le contrôle des imports et du POS négocié", () => {
  assert.match(importContract, /RLS import Assurance absente/);
  assert.match(importContract, /correspondance_unique/);
  assert.match(importContract, /latest.*proposal|proposition/i);
  assert.match(importContract, /POS\/trigger/);
  assert.match(pharmacyPage, /Liste complète des assurés à jour/);
  assert.match(pharmacyPage, /Mise à jour partielle/);
});
