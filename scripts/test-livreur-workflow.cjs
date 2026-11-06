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
  reoffer: read("supabase/migrations/20261106171000_livreur_reoffer_offer_history.sql"),
  clientNotification: read("supabase/migrations/20261106172000_livreur_client_notification_recipient.sql"),
  dispatchNotification: read("supabase/migrations/20261106172100_livreur_dispatch_notification_recipient.sql"),
  reofferNotification: read("supabase/migrations/20261106172200_livreur_reoffer_notification_recipient.sql"),
  inviteNotification: read("supabase/migrations/20261106172300_livreur_invite_notification_recipient.sql"),
  identityGuards: read("supabase/migrations/20261106172400_livreur_identity_verification_guards.sql"),
  inviteHardening: read("supabase/migrations/20261106173000_livreur_invite_cross_actor_scope_and_recipient_fix.sql"),
  pharmacyGuards: read("supabase/migrations/20261106172500_livreur_active_pharmacy_guards.sql"),
  pharmacyRevoke: read("supabase/migrations/20261106172600_livreur_pharmacy_revoke_assignment.sql"),
  managementRpc: read("supabase/migrations/20261106172700_livreur_management_list_rpc.sql"),
  assignmentManager: read("src/components/pharmacie/LivreursAssignmentsManager.tsx"),
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
  assert.ok(files.schema.includes("if new.role_code='livreur' then"));
  assert.ok(files.schema.includes("and a.role_code<>'livreur'"));
  assert.ok(files.schema.includes("if v_profile_role<>'client' then"));
  assert.match(files.schema, /naxa_grant_livreur_assignment/);
  assert.match(files.schema, /pg_advisory_xact_lock/);
  assert.match(files.schema, /naxa_delivery_missions/);
});


test("l’acceptation d’invitation valide l’émetteur hors session du bénéficiaire, l’âge et le destinataire", () => {
  assert.ok(files.inviteHardening.includes("private.naxa_business_function(v_invite.inviteur_id)"));
  assert.ok(files.inviteHardening.includes("private.naxa_active_role_pharmacy(v_invite.inviteur_id)"));
  assert.ok(files.inviteHardening.includes("private.naxa_scope_allows(v_invite.inviteur_id,v_invite.pharmacie_id,'PHARMACIE')"));
  assert.ok(files.inviteHardening.includes("date_of_birth <= (current_date - interval '18 years')::date"));
  assert.ok(files.inviteHardening.includes("notifications(user_id,type,titre,corps,related_entity_id)"));
  assert.ok(!files.inviteHardening.includes("notifications(user_id,pharmacie_id"));
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

test("les notifications respectent la contrainte de destinataire unique", () => {
  assert.ok(files.clientNotification.includes("notifications(user_id,type,titre,corps,reservation_id,related_entity_id)"));
  assert.ok(files.dispatchNotification.includes("notifications(user_id,type,titre,corps,reservation_id,related_entity_id)"));
  assert.ok(files.reofferNotification.includes("notifications(user_id,type,titre,corps,reservation_id,related_entity_id)"));
  assert.ok(files.inviteNotification.includes("notifications(user_id,type,titre,corps,related_entity_id)"));
  assert.ok(!files.clientNotification.includes("notifications(user_id,pharmacie_id"));
});

test("l'identité Livreur exige un e-mail vérifié, le consentement et 18 ans révolus", () => {
  assert.ok(files.identityGuards.includes("u.email_confirmed_at is not null"));
  assert.ok(files.identityGuards.includes("date_of_birth <= (current_date - interval '18 years')::date"));
  assert.match(files.identityGuards, /consent_accepted_at is not null/);
});

test("la Pharmacie peut gérer et révoquer ses Livreurs sans interrompre une mission", () => {
  assert.ok(files.pharmacyRevoke.includes("elsif v_actor_role='pharmacie' and v_assignment.role_code='livreur' then"));
  assert.ok(files.pharmacyRevoke.includes("naxa_active_role_pharmacy(v_actor)"));
  assert.ok(files.pharmacyRevoke.includes("naxa_scope_allows(v_actor,v_assignment.pharmacie_id,'PHARMACIE')"));
  assert.match(files.schema, /naxa_block_livreur_revoke_with_open_delivery/);
});

test("les missions sont bloquées si la pharmacie est suspendue ou archivée", () => {
  assert.ok(files.pharmacyGuards.includes("ph.actif=true and ph.archivee_le is null"));
  assert.ok(files.pharmacyGuards.includes("La pharmacie est suspendue ou archivée"));
});

test("une mission peut être réaffectée avant collecte, jamais après", () => {
  assert.ok(files.reoffer.includes("v_m.picked_up_at is not null"));
  assert.ok(files.reoffer.includes("set offer_status='recalled'"));
  assert.ok(files.reoffer.includes("update public.reservations set commande_statut='preparation'"));
});

test("la prise de mission est atomique et le journal des offres reste privé", () => {
  assert.ok(files.offers.includes("select * into v_m from public.naxa_delivery_missions where id=p_mission for update"));
  assert.ok(files.offers.includes("update public.naxa_delivery_mission_offers"));
  assert.ok(files.offers.includes("else 'lost' end"));
  assert.ok(files.offers.includes("'acceptance_rate'"));
  assert.ok(files.offers.includes("revoke all on public.naxa_delivery_mission_offers from public,anon,authenticated;"));
  assert.ok(files.hardening.includes("private.naxa_delivery_driver_can_act"));
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

test("la gestion de l’équipe Livreur est cloisonnée au réseau et compte les personnes distinctes", () => {
  assert.ok(files.managementRpc.includes("create or replace function public.naxa_livreurs_management_list"));
  assert.ok(files.managementRpc.includes("if v_role='promoteur'"));
  assert.ok(files.managementRpc.includes("elsif v_role='pharmacie'"));
  assert.ok(files.managementRpc.includes("public.is_admin()"));
  assert.ok(files.managementRpc.includes("revoke all on function public.naxa_livreurs_management_list(uuid[]) from public,anon"));
  assert.ok(files.managementRpc.includes("grant execute on function public.naxa_livreurs_management_list(uuid[]) to authenticated"));
  assert.ok(files.assignmentManager.includes("naxa_livreurs_management_list"));
  assert.ok(files.assignmentManager.includes("new Set("));
});

test("les nouveaux modules TS/TSX sont syntaxiquement valides", () => {
  const targets = [
    "src/app/pharmacie/livreur/page.tsx",
    "src/app/pharmacie/gestionnaire-stock/commandes/page.tsx",
    "src/app/pharmacie/commandes/page.tsx",
    "src/app/reservation/[id]/page.tsx",
    "src/app/pharmacie/affectations/page.tsx",
    "src/components/pharmacie/LivreursAssignmentsManager.tsx",
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
