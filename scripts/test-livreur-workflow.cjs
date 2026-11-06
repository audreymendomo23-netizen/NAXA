const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const files = {
  schema: read("supabase/migrations/20261106150000_livreur_delivery_workflow.sql"),
  hardening: read("supabase/migrations/20261106152000_livreur_delivery_rpc_hardening.sql"),
  invites: read("supabase/migrations/20261106154000_livreur_invitation_signup.sql"),
  inviteFix: read("supabase/migrations/20261106160000_livreur_invite_acceptance_and_notifications.sql"),
  offers: read("supabase/migrations/20261106163000_livreur_offers_cancellation_metrics.sql"),
  stockGate: read("supabase/migrations/20261106170000_livreur_stock_preparation_gate.sql"),
  stockPage: read("src/app/pharmacie/gestionnaire-stock/commandes/page.tsx"),
  stockActions: read("src/app/pharmacie/gestionnaire-stock/actions.ts"),
  courierPage: read("src/app/pharmacie/livreur/page.tsx"),
  courierUi: read("src/components/pharmacie/LivreurWorkspaceClient.tsx"),
  clientTracking: read("src/components/SuiviLivraison.tsx"),
  orderPage: read("src/app/pharmacie/commandes/page.tsx"),
  inviteForm: read("src/components/pharmacie/InvitationLivreurForm.tsx"),
  invitePage: read("src/app/invitation/livreur/page.tsx"),
  inviteClient: read("src/components/AcceptCourierInvitationClient.tsx"),
  assignmentPage: read("src/app/pharmacie/affectations/page.tsx"),
  assignmentActions: read("src/app/pharmacie/affectations/actions.ts"),
};

test("le Livreur reste un poste exclusif, mais peut être attribué à plusieurs pharmacies", () => {
  assert.match(files.schema, /new\.role_code='livreur'/);
  assert.match(files.schema, /new\.role_code<>'livreur'/);
  assert.match(files.schema, /v_profile_role<>'client'/);
  assert.match(files.schema, /naxa_grant_livreur_assignment/);
  assert.match(files.schema, /pg_advisory_xact_lock/);
  assert.match(files.schema, /naxa_delivery_missions/);
});

test("l'invitation est à usage unique et exige un compte Client vérifié", () => {
  assert.match(files.invites, /expires_at timestamptz not null default \(now\(\)\+interval '7 days'\)/);
  assert.match(files.invites, /accepted_at is null/);
  assert.match(files.invites, /email_confirmed_at/);
  assert.match(files.invites, /age_verified=true/);
  assert.match(files.invites, /consent_accepted_at is not null/);
  assert.match(files.invites, /role_code<>'livreur'/);
  assert.match(files.inviteFix, /naxa_revoke_livreur_invite/);
  assert.match(files.inviteClient, /naxa_accept_livreur_invite/);
});

test("la livraison ne peut être publiée qu'après la preuve de préparation physique Stock", () => {
  assert.match(files.stockGate, /v_r\.preparation_statut<>'prete_au_retrait'/);
  assert.match(files.stockGate, /gestionnaire_stock_commande_preparation/);
  assert.match(files.stockPage, /mettreCommandeEnPreparationStock/);
  assert.match(files.stockPage, /marquerCommandePretePourLivraison/);
  assert.match(files.stockPage, /publierCommandePourLivreurs/);
  assert.match(files.stockActions, /naxa_delivery_make_available/);
});

test("la prise de mission est atomique et le journal des offres reste privé", () => {
  assert.match(files.offers, /select \* into v_m from public\.naxa_delivery_missions where id=p_mission for update/);
  assert.match(files.offers, /update public\.naxa_delivery_mission_offers/);
  assert.match(files.offers, /offer_status='lost'/);
  assert.match(files.offers, /acceptance_rate/);
  assert.match(files.offers, /revoke all on public\.naxa_delivery_mission_offers from public,anon,authenticated/);
  assert.match(files.hardening, /naxa_delivery_driver_can_act/);
});

test("le Livreur ne modifie ni stock, ni paiement, ni statut final de remise", () => {
  assert.match(files.courierPage, /role!=="livreur"/);
  assert.match(files.courierUi, /naxa_delivery_accept/);
  assert.match(files.courierUi, /naxa_delivery_pickup/);
  assert.match(files.courierUi, /naxa_delivery_arrived/);
  assert.match(files.courierUi, /naxa_delivery_add_location/);
  assert.match(files.courierUi, /naxa_delivery_report_issue/);
  assert.doesNotMatch(files.courierUi, /naxa_delivery_confirm_received/);
  assert.doesNotMatch(files.courierUi, /mettre_a_jour_commande_client/);
});

test("le Client voit le parcours et reste le seul à confirmer la réception", () => {
  assert.match(files.clientTracking, /naxa_delivery_tracking/);
  assert.match(files.clientTracking, /naxa_delivery_confirm_received/);
  assert.match(files.clientTracking, /tracking\.statut==="arrived"/);
  assert.match(files.inviteFix, /trigger/);
  assert.match(files.offers, /Un livreur a déjà accepté cette commande/);
});

test("l'interface Pharmacie ne propose plus de simuler les étapes du Livreur", () => {
  assert.match(files.orderPage, /next:Record<string,string>\s*=\s*\{en_attente_pharmacie:"acceptee",acceptee:"preparation"\}/);
  assert.doesNotMatch(files.orderPage, /preparation:"livreur_assigne"/);
  assert.doesNotMatch(files.orderPage, /en_livraison:"livree"/);
});

test("les nouveaux modules TS/TSX sont syntaxiquement valides", () => {
  const targets = [
    "src/app/pharmacie/livreur/page.tsx",
    "src/app/pharmacie/gestionnaire-stock/commandes/page.tsx",
    "src/app/reservation/[id]/page.tsx",
    "src/app/pharmacie/affectations/page.tsx",
    "src/app/pharmacie/affectations/actions.ts",
    "src/components/pharmacie/InvitationLivreurForm.tsx",
    "src/components/pharmacie/LivreurWorkspaceClient.tsx",
    "src/components/SuiviLivraison.tsx",
    "src/components/AcceptCourierInvitationClient.tsx",
    "src/app/invitation/livreur/page.tsx",
  ];
  for (const file of targets) {
    const source = read(file);
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    assert.equal(parsed.parseDiagnostics.length, 0, file + ": " + parsed.parseDiagnostics.map(d => d.messageText).join("; "));
  }
});

process.stdout.write("Contrats statiques du workflow Livreur vérifiés.\n");
