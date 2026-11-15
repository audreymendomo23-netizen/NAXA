"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261115101000_assurance_amount_proposal_workflow.sql"), "utf8");
const sqlContract = fs.readFileSync(path.join(root, "supabase/tests/20261115101000_assurance_amount_proposal_workflow.sql"), "utf8");
const client = fs.readFileSync(path.join(root, "src/components/assurance/AssuranceReceiptDetails.tsx"), "utf8");
const pharmacy = fs.readFileSync(path.join(root, "src/app/pharmacie/assurance/page.tsx"), "utf8");
const activeClientMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261115102000_assurance_proposal_response_requires_active_client_role.sql"), "utf8");
const refusalEventMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261115103000_assurance_client_refusal_event_visibility.sql"), "utf8");
const accountingIdempotenceMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261115104000_assurance_accounting_event_idempotence_scope.sql"), "utf8");
const refusalEventSqlTest = fs.readFileSync(path.join(root, "supabase/tests/20261115103000_assurance_client_refusal_event_visibility.sql"), "utf8");
const accountingIdempotenceSqlTest = fs.readFileSync(path.join(root, "supabase/tests/20261115104000_assurance_accounting_event_idempotence_scope.sql"), "utf8");

test("la proposition de montant est versionnée et séparée du snapshot initial", () => {
  assert.match(migration, /create table if not exists public\.assurance_montant_propositions/);
  assert.match(migration, /unique \(dossier_id, version\)/);
  assert.match(migration, /where statut='proposee'/);
  assert.match(migration, /montant_modifie_le=now\(\)/);
  assert.doesNotMatch(
    migration.slice(migration.indexOf("create or replace function public.assurance_proposer_montant"), migration.indexOf("create or replace function public.assurance_repondre_proposition_montant")),
    /set\s+montant_brut_fcfa\s*=|set\s+montant_assureur_fcfa\s*=|set\s+montant_client_fcfa\s*=/i
  );
});

test("la pharmacie ne peut proposer qu'une réduction de la part assureur dans son périmètre", () => {
  const propose = migration.slice(
    migration.indexOf("create or replace function public.assurance_proposer_montant"),
    migration.indexOf("create or replace function public.assurance_repondre_proposition_montant")
  );
  assert.match(propose, /private\.naxa_business_function/);
  assert.match(propose, /'promoteur','pharmacien','responsable'/);
  assert.match(propose, /private\.naxa_scope_allows/);
  assert.match(propose, /v_s\.valide_client is not true/);
  assert.match(propose, /p_montant_assureur_fcfa>least/);
  assert.match(propose, /v_s\.montant_assureur_fcfa/);
  assert.match(propose, /motif/);
  assert.match(propose, /set statut='remplacee'/);
});

test("le Client propriétaire peut accepter ou refuser, sans réécrire les montants du devis initial", () => {
  const respond = migration.slice(
    migration.indexOf("create or replace function public.assurance_repondre_proposition_montant"),
    migration.indexOf("create or replace function public.assurance_confirmer_prise_en_charge")
  );
  assert.match(respond, /p\.role='client'/);
  assert.match(respond, /p_accepter is null/);
  assert.match(respond, /v_d\.client_id is distinct from v_uid/);
  assert.match(respond, /set montant_prise_en_charge=v_p\.montant_assureur_fcfa/);
  assert.match(respond, /set accord_client_modification_le=now\(\)/);
  assert.match(respond, /accord_client_obtenu/);
  assert.match(respond, /accord_client_refuse/);
  assert.doesNotMatch(respond, /set montant_brut_fcfa\s*=|set montant_assureur_fcfa\s*=|set montant_client_fcfa\s*=/i);
});

test("la confirmation finale est bloquée tant qu'une proposition attend la réponse du Client", () => {
  const confirm = migration.slice(migration.indexOf("create or replace function public.assurance_confirmer_prise_en_charge"));
  assert.match(confirm, /p\.statut='proposee'/);
  assert.match(confirm, /proposition de montant attend encore la décision du Client/);
  assert.match(confirm, /controle_documents_statut<>'conforme'/);
});

test("le Client voit et peut décider une proposition en attente depuis le suivi de sa réservation", () => {
  assert.match(client, /assurance_montant_propositions/);
  assert.match(client, /assurance_repondre_proposition_montant/);
  assert.match(client, /Accepter cette modification/);
  assert.match(client, /Refuser cette modification/);
  assert.match(client, /devis initial/);
  assert.match(client, /Historique des propositions/);
});

test("les postes professionnels autorisés peuvent envoyer une proposition et voir l'historique", () => {
  assert.match(pharmacy, /assurance_proposer_montant/);
  assert.match(pharmacy, /"promoteur","pharmacien","responsable"/);
  assert.match(pharmacy, /Proposer un autre partage du montant/);
  assert.match(pharmacy, /Remplacer la proposition en attente/);
  assert.match(pharmacy, /La confirmation définitive de la prise en charge est bloquée/);
  assert.match(pharmacy, /Historique des propositions/);
});

test("les contrats SQL couvrent RLS, ACL, montant initial immuable et événement de refus", () => {
  assert.match(sqlContract, /assurance_montant_propositions_pending_dossier_uq/);
  assert.match(sqlContract, /has_table_privilege\('authenticated'.*'INSERT'/s);
  assert.match(sqlContract, /assurance_proposer_montant/);
  assert.match(sqlContract, /assurance_repondre_proposition_montant/);
  assert.match(sqlContract, /accord_client_refuse/);
});


test("la décision exige le rôle métier Client actif, et non une simple racine de profil Client", () => {
  assert.match(activeClientMigration, /naxa_business_function\(v_uid\)<>'client'/);
  assert.match(activeClientMigration, /p\.role='client' and p\.actif=true/);
});

test("le refus reste lisible par le Client propriétaire et par le personnel de sa pharmacie", () => {
  assert.match(refusalEventMigration, /accord_client_refuse/);
  assert.match(refusalEventMigration, /r\.client_id=\(select auth\.uid\(\)\)/);
  assert.match(refusalEventSqlTest, /accord_client_refuse/);
});

test("la créance Assurance utilise la clé d'idempotence unique réellement définie en comptabilité", () => {
  assert.match(accountingIdempotenceMigration, /on conflict \(pharmacie_id,cle_idempotence\) do nothing/i);
  assert.doesNotMatch(accountingIdempotenceMigration, /on conflict \(cle_idempotence\) do nothing/i);
  assert.match(accountingIdempotenceSqlTest, /compta_evenement_pharmacie_id_cle_idempotence_key/);
});
