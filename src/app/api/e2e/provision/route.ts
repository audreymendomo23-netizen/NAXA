import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHARMACY_NAMES = [
  "NAXA E2E — Pharmacie Bastos",
  "NAXA E2E — Pharmacie Mvan",
  "NAXA E2E — Pharmacie Essos",
] as const;

const ACCOUNTS = [
  { key: "client01", email: "naxa.e2e.client01@example.com", username: "naxa_e2e_client01", first: "NAXA", last: "Client 01", phone: "+237690000001", roleLabel: "Client" },
  { key: "client02", email: "naxa.e2e.client02@example.com", username: "naxa_e2e_client02", first: "NAXA", last: "Client 02", phone: "+237690000002", roleLabel: "Client" },
  { key: "client03", email: "naxa.e2e.client03@example.com", username: "naxa_e2e_client03", first: "NAXA", last: "Client 03", phone: "+237690000003", roleLabel: "Client" },
  { key: "promoteur", email: "naxa.e2e.promoteur@example.com", username: "naxa_e2e_promoteur", first: "NAXA", last: "Promoteur E2E", phone: "+237690000004", roleLabel: "Promoteur" },
  { key: "responsable", email: "naxa.e2e.responsable@example.com", username: "naxa_e2e_responsable", first: "NAXA", last: "Responsable E2E", phone: "+237690000005", roleLabel: "Responsable", assignment: "responsable", pharmacy: "Bastos" },
  { key: "comptable", email: "naxa.e2e.comptable@example.com", username: "naxa_e2e_comptable", first: "NAXA", last: "Comptable E2E", phone: "+237690000006", roleLabel: "Comptable", assignment: "comptable", pharmacy: "Mvan" },
  { key: "pharmacien", email: "naxa.e2e.pharmacien@example.com", username: "naxa_e2e_pharmacien", first: "NAXA", last: "Pharmacien E2E", phone: "+237690000007", roleLabel: "Pharmacien", assignment: "pharmacien", pharmacy: "Essos" },
  { key: "stock", email: "naxa.e2e.stock@example.com", username: "naxa_e2e_stock", first: "NAXA", last: "Stock E2E", phone: "+237690000008", roleLabel: "Gestionnaire de stock", assignment: "gestionnaire_stock", pharmacy: "Essos" },
  { key: "caisse", email: "naxa.e2e.caisse@example.com", username: "naxa_e2e_caisse", first: "NAXA", last: "Caisse E2E", phone: "+237690000009", roleLabel: "Caissier", assignment: "caisse", pharmacy: "Bastos" },
  { key: "livreur", email: "naxa.e2e.livreur@example.com", username: "naxa_e2e_livreur", first: "NAXA", last: "Livreur E2E", phone: "+237690000010", roleLabel: "Livreur", assignment: "livreur", pharmacy: "Mvan" },
  { key: "multi", email: "naxa.e2e.multipostes@example.com", username: "naxa_e2e_multipostes", first: "NAXA", last: "Test Multi Postes", phone: "+237690000011", roleLabel: "Test multi-postes", assignments: ["gestionnaire_stock", "comptable"], pharmacy: "Essos" },
] as const;

function sameSecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function password(): string {
  return `NxaE2E-${randomBytes(18).toString("base64url")}!9`;
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Route réservée à Preview." }, { status: 404 });
  }

  const expectedSecret = process.env.NAXA_E2E_PROVISION_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "Provisionnement E2E non configuré." }, { status: 503 });
  }
  const url = new URL(request.url);
  if (!sameSecret(url.searchParams.get("key"), expectedSecret)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }

  const credentials: Array<{ key: string; email: string; username: string; password: string; role: string; pharmacy?: string }> = [];

  try {
    const admin = supabaseAdmin();

    const { data: pharmacies, error: pharmacyError } = await admin
      .from("pharmacies")
      .select("id, nom, actif, est_demo")
      .in("nom", [...PHARMACY_NAMES]);
    if (pharmacyError) throw new Error(`Lecture pharmacies E2E impossible: ${pharmacyError.message}`);
    if (!pharmacies || pharmacies.length !== 3 || pharmacies.some((p) => !p.actif || !p.est_demo)) {
      throw new Error("Les trois pharmacies E2E attendues doivent exister, être actives et être marquées démo.");
    }

    const pharmacyByKey = {
      Bastos: pharmacies.find((p) => p.nom === PHARMACY_NAMES[0])!.id,
      Mvan: pharmacies.find((p) => p.nom === PHARMACY_NAMES[1])!.id,
      Essos: pharmacies.find((p) => p.nom === PHARMACY_NAMES[2])!.id,
    };

    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw new Error(`Lecture Auth impossible: ${listError.message}`);
    const byEmail = new Map((listed.users ?? []).map((user) => [user.email?.toLowerCase() ?? "", user]));

    const userIds = new Map<string, string>();
    for (const spec of ACCOUNTS) {
      const userPassword = password();
      const metadata = {
        username: spec.username,
        first_name: spec.first,
        last_name: spec.last,
        phone: spec.phone,
        phone_country: "CM",
        date_of_birth: "1990-01-01",
        consent_accepted: true,
        naxa_signup_pending: false,
        naxa_signup_completed: true,
      };
      const existing = byEmail.get(spec.email);
      let userId: string;

      if (existing) {
        const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
          password: userPassword,
          user_metadata: metadata,
        });
        if (error || !data.user) throw new Error(`Mise à jour Auth impossible pour ${spec.key}: ${error?.message ?? "utilisateur absent"}`);
        userId = data.user.id;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: spec.email,
          password: userPassword,
          email_confirm: true,
          user_metadata: metadata,
        });
        if (error || !data.user) throw new Error(`Création Auth impossible pour ${spec.key}: ${error?.message ?? "utilisateur absent"}`);
        userId = data.user.id;
      }

      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      if (profileError || !profile) {
        throw new Error(`Profil NAXA absent pour ${spec.key}: ${profileError?.message ?? "trigger Auth non exécuté"}`);
      }

      userIds.set(spec.key, userId);
      credentials.push({
        key: spec.key,
        email: spec.email,
        username: spec.username,
        password: userPassword,
        role: spec.roleLabel,
        ...( "pharmacy" in spec ? { pharmacy: spec.pharmacy } : {}),
      });
    }

    const promoterId = userIds.get("promoteur");
    if (!promoterId) throw new Error("Compte Promoteur introuvable après création.");

    const { error: promoterProfileError } = await admin.from("profiles").update({
      role: "promoteur",
      actif: true,
      niveau_interne: 1,
      architecture_code: "HYBRIDE",
      parent_profile_id: null,
      pharmacie_id: null,
      fonction_interne: "promoteur",
    }).eq("id", promoterId);
    if (promoterProfileError) throw new Error(`Profil Promoteur impossible: ${promoterProfileError.message}`);

    const today = new Date().toISOString().slice(0, 10);
    const farFuture = "2099-12-31";
    const testFeeFcfa = 1;
    const { data: convention, error: conventionError } = await admin
      .from("conventions_promoteurs")
      .upsert({
        promoteur_id: promoterId,
        montant_mensuel: testFeeFcfa,
        date_paiement: null,
        date_expiration: farFuture,
        statut: "active",
        architecture_code: "HYBRIDE",
      }, { onConflict: "promoteur_id" })
      .select("id")
      .single();
    if (conventionError || !convention) throw new Error(`Convention E2E impossible: ${conventionError?.message ?? "aucune ligne"}`);

    const { error: subscriptionError } = await admin
      .from("abonnements_promoteurs")
      .upsert({
        promoteur_id: promoterId,
        convention_id: convention.id,
        montant_mensuel: testFeeFcfa,
        debut: today,
        echeance: farFuture,
        statut: "actif",
      }, { onConflict: "promoteur_id" });
    if (subscriptionError) throw new Error(`Abonnement technique Replay impossible: ${subscriptionError.message}`);

    const { error: linksError } = await admin.from("promoteur_pharmacies").upsert(
      pharmacies.map((pharmacy) => ({ promoteur_id: promoterId, pharmacie_id: pharmacy.id, actif: true })),
      { onConflict: "promoteur_id,pharmacie_id" },
    );
    if (linksError) throw new Error(`Rattachement Promoteur/pharmacies impossible: ${linksError.message}`);

    const { error: promoterActiveRoleError } = await admin.from("naxa_profile_active_roles").upsert({
      profile_id: promoterId,
      role_code: "promoteur",
      pharmacie_id: null,
      selected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });
    if (promoterActiveRoleError) throw new Error(`Sélection du rôle Promoteur impossible: ${promoterActiveRoleError.message}`);

    const clientIds = ["client01", "client02", "client03"].map((key) => userIds.get(key)!);
    for (const profileId of clientIds) {
      const { error } = await admin.from("naxa_profile_active_roles").upsert({
        profile_id: profileId,
        role_code: "client",
        pharmacie_id: null,
        selected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id" });
      if (error) throw new Error(`Sélection de l’espace client impossible: ${error.message}`);
    }

    const assignments: Array<{ accountKey: string; role: string; pharmacy: keyof typeof pharmacyByKey }> = [
      { accountKey: "responsable", role: "responsable", pharmacy: "Bastos" },
      { accountKey: "comptable", role: "comptable", pharmacy: "Mvan" },
      { accountKey: "pharmacien", role: "pharmacien", pharmacy: "Essos" },
      { accountKey: "stock", role: "gestionnaire_stock", pharmacy: "Essos" },
      { accountKey: "caisse", role: "caisse", pharmacy: "Bastos" },
      { accountKey: "livreur", role: "livreur", pharmacy: "Mvan" },
      { accountKey: "multi", role: "gestionnaire_stock", pharmacy: "Essos" },
      { accountKey: "multi", role: "comptable", pharmacy: "Essos" },
    ];

    for (const assignment of assignments) {
      const profileId = userIds.get(assignment.accountKey);
      if (!profileId) throw new Error(`Compte absent pour affectation ${assignment.accountKey}`);
      const pharmacyId = pharmacyByKey[assignment.pharmacy];
      const { data: existingAssignment, error: assignmentLookupError } = await admin
        .from("naxa_professional_assignments")
        .select("id")
        .eq("profile_id", profileId)
        .eq("pharmacie_id", pharmacyId)
        .eq("role_code", assignment.role)
        .eq("statut", "active")
        .limit(1)
        .maybeSingle();
      if (assignmentLookupError) throw new Error(`Vérification affectation impossible: ${assignmentLookupError.message}`);

      if (!existingAssignment) {
        const { error } = await admin.from("naxa_professional_assignments").insert({
          profile_id: profileId,
          pharmacie_id: pharmacyId,
          fonction: assignment.role,
          role_code: assignment.role,
          statut: "active",
          nature_affectation: "ordinaire",
          motif: "Affectation temporaire de recette E2E NAXA sur Replay.",
          commence_at: new Date(Date.now() - 60_000).toISOString(),
          expire_at: null,
          accorde_par: promoterId,
        });
        if (error) throw new Error(`Affectation ${assignment.role} impossible pour ${assignment.accountKey}: ${error.message}`);
      }
    }

    const verification: Array<{ key: string; activeRole: string | null; activePharmacy: string | null }> = [];
    for (const spec of ACCOUNTS) {
      const profileId = userIds.get(spec.key)!;
      const { data: role, error } = await admin.rpc("naxa_business_function", { p_profile: profileId });
      if (error) throw new Error(`Vérification du rôle actif impossible pour ${spec.key}: ${error.message}`);
      const { data: activeRole, error: activeError } = await admin
        .from("naxa_profile_active_roles")
        .select("role_code,pharmacie_id")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (activeError) throw new Error(`Lecture du poste actif impossible pour ${spec.key}: ${activeError.message}`);
      verification.push({
        key: spec.key,
        activeRole: typeof role === "string" ? role : null,
        activePharmacy: activeRole?.pharmacie_id ?? null,
      });
    }

    const { data: promoterValid, error: promoterValidError } = await admin.rpc("naxa_business_function", { p_profile: promoterId });
    if (promoterValidError || promoterValid !== "promoteur") {
      throw new Error(`Le rôle Promoteur n'est pas valide: ${promoterValidError?.message ?? String(promoterValid)}`);
    }

    return NextResponse.json({
      ok: true,
      environment: "preview",
      supabaseProject: "pwfftcsjyeibxxqhwysw",
      createdOrReset: credentials.length,
      promoterSyntheticSubscription: { monthlyFeeFcfa: testFeeFcfa, noPaymentRecorded: true, expires: farFuture },
      pharmacies: pharmacies.map((pharmacy) => pharmacy.nom),
      accounts: credentials,
      verification,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Erreur de provisionnement inconnue.",
      partialAccounts: credentials,
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
