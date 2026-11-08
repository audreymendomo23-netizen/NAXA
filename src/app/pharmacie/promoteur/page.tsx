import Link from "next/link";
import { PromoteurSectionStyles } from "@/components/pharmacie/PromoteurSectionStyles";
import RapportsALaDemande from "@/components/RapportsALaDemande";

import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { fcfa } from "@/lib/ranking";
import { CaisseSecurityManager } from "@/components/pharmacie/CaisseSecurityManager";
import { AvisRappelsLotsPromoteur } from "@/components/pharmacie/AvisRappelsLotsPromoteur";
import { loadPromoteurAccess } from "@/lib/promoteur-access";
import { PromoteurHashRedirect } from "@/components/pharmacie/PromoteurHashRedirect";
import { PromoteurPasswordForm } from "@/components/pharmacie/PromoteurPasswordForm";
import { PromoteurLogoManager } from "@/components/pharmacie/PromoteurLogoManager";
import { PromoteurKpiValue } from "@/components/pharmacie/PromoteurKpiValue";
import { EspaceNaxaSwitcher } from "@/components/EspaceNaxaSwitcher";
import PromoteurGeolocalisationReseau from "@/components/pharmacie/PromoteurGeolocalisationReseau";
import { PromoteurSecuriteIntelligente } from "@/components/pharmacie/PromoteurSecuriteIntelligente";

type Stats = {
  pharmacies?: { total?: number; actives?: number; inactives?: number };
  recherches?: { total?: number; sans_resultat?: number };
  entonnoir?: { recherches?: number; fiches_vues?: number; paniers?: number; reservations?: number; ventes?: number };
  ca?: number;
  stock?: { produits_en_stock?: number; ruptures?: number };
  alertes?: number;
  serie?: { jour: string; recherches: number; reservations: number; ventes: number }[];
};

const date = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString("fr-FR") : "Non renseignée";
const dateTime = (v: string | null | undefined) => v ? new Date(v).toLocaleString("fr-FR") : "Non renseignée";

export async function PromoteurDashboard({ section = "overview", geoStatus }: { section?: string; geoStatus?: string }) {
  const access = await loadPromoteurAccess();
  const { auth, profile, links, linksError, pharmacies, pharmaciesError, convention, abonnement, activeLinkIds, expiryDate, isCommerciallyBlocked, contractDataUnavailable, contractIncomplete, shouldShowAccessStatus, hasLoadError } = access;
  const sb = supabaseServer();
  const adminDb = supabaseAdmin();

  const ids = [...new Set((links ?? []).map((x) => x.pharmacie_id))];
  const { data: caisses, error: caissesError } = ids.length
    ? await adminDb.from("profiles")
        .select("id,username,first_name,last_name,pharmacie_id,actif,parent_profile_id,niveau_interne,fonction_interne")
        .in("pharmacie_id", ids)
        .eq("role", "caisse")
    : { data: [] as {id:string;username:string|null;first_name:string|null;last_name:string|null;pharmacie_id:string|null;actif:boolean;parent_profile_id:string|null;niveau_interne:number|null;fonction_interne:string|null}[], error: null };
  const operationalIds = [...new Set((links ?? []).filter((link) => link.actif && (pharmacies ?? []).some((ph) => ph.id === link.pharmacie_id && ph.actif && ph.visible_recherche)).map((link) => link.pharmacie_id))];
  const { data: caisseRows } = operationalIds.length
    ? await adminDb.from("caisses").select("id,nom,pharmacie_id").in("pharmacie_id", operationalIds)
    : { data: [] as { id: string; nom: string; pharmacie_id: string }[] };
  const caisseIds = (caisseRows ?? []).map((c) => c.id);
  const { data: caisseSessions, error: ecartsCaisseError } = caisseIds.length
    ? await adminDb.from("caisses_sessions")
        .select("id,caisse_id,ouvert_par,ouvert_at,statut,cloture_at,cloture_par,total_theorique,total_compte,ecart,ecart_justification,ecart_statut")
        .in("caisse_id", caisseIds).order("ouvert_at", { ascending: false }).limit(50)
    : { data: [] as { id: string; caisse_id: string; ouvert_par: string; ouvert_at: string; statut: string; cloture_at: string | null; cloture_par: string | null; total_theorique: number; total_compte: number | null; ecart: number | null; ecart_justification?: string | null; ecart_statut?: string }[], error: null };
  const ecartsCaisse = (caisseSessions ?? []).filter((s) => s.cloture_at && Number(s.ecart ?? 0) !== 0).slice(0, 20);
  const caisseById = new Map((caisseRows ?? []).map((c) => [c.id, c] as const));

  const { data: statsData, error: statsError } = profile.actif === true
    ? await sb.rpc("stats_pilotage_scope", { p_jours: 30 })
    : { data: null, error: null };
  
  // Les tables contractuelles sont administrées par NAXA. La clé service-role
  // est utilisée uniquement après authentification et avec un filtre strict sur
  // l'identifiant du Promoteur courant.
  if (shouldShowAccessStatus) {
    const accessBlocked = isCommerciallyBlocked;
    const contractNeedsReview = !accessBlocked && contractIncomplete;
    const statusUnavailable = contractDataUnavailable || hasLoadError;
    const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Promoteur";
    return (
      <main className="min-h-dvh bg-naxa-green-50 px-4 py-8 text-naxa-green-900">
        <div className="mx-auto max-w-3xl space-y-5">
          <header className="rounded-3xl bg-naxa-green-900 p-6 text-white sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">NAXA · Espace Promoteur</p>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{accessBlocked ? "Accès commercial suspendu" : statusUnavailable ? "Statut momentanément indisponible" : contractNeedsReview ? "Dossier à finaliser" : `Bienvenue, ${displayName}`}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">{accessBlocked ? "Le contrat ou la validité commerciale ne permet pas actuellement d’utiliser les outils du réseau." : statusUnavailable ? "NAXA n’a pas pu confirmer le statut contractuel ou le périmètre du réseau. Les outils restent fermés par précaution ; réessayez plus tard." : contractNeedsReview ? "La convention et l’abonnement doivent être cohérents avant l’ouverture des outils de gestion." : "Votre espace est préparé. NAXA termine les contrôles nécessaires avant l’ouverture des outils de gestion."}</p>
          </header>

          {hasLoadError && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Le statut détaillé ne peut pas être chargé pour le moment. Aucun accès n’a été activé par cette page.</p>}

          <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-none sm:p-6">
            <div className="flex items-start gap-3">
              <span className={accessBlocked ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-xl" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl"} aria-hidden="true">{accessBlocked ? "!" : "◷"}</span>
              <div>
                <p className={accessBlocked ? "text-xs font-bold uppercase tracking-[.14em] text-red-800" : "text-xs font-bold uppercase tracking-[.14em] text-amber-800"}>{accessBlocked ? "Abonnement / validité" : statusUnavailable ? "Vérification impossible" : contractNeedsReview ? "Configuration contractuelle" : "Dossier en cours"}</p>
                <h2 className="mt-1 text-xl font-extrabold">{accessBlocked ? "Accès suspendu — régularisation requise" : statusUnavailable ? "Statut non confirmé" : contractNeedsReview ? "Convention et abonnement à vérifier" : "Activation en attente de validation"}</h2>
                <p className="mt-2 text-sm leading-6 text-naxa-green-700">{accessBlocked ? "Les fonctions réseau restent fermées tant que la validité commerciale n’est pas rétablie par le processus NAXA. Cette page ne réactive aucun compte et n’effectue aucun paiement." : statusUnavailable ? "La vérification du dossier n’a pas abouti. Aucun accès n’est accordé sur la base de données incomplètes." : contractNeedsReview ? "Le compte ne peut pas utiliser les fonctions réseau tant que NAXA n’a pas confirmé l’unicité de la convention, le rattachement de l’abonnement et l’égalité du tarif." : "Le compte Promoteur ne peut pas encore administrer de pharmacie, créer des Caisses ou consulter les indicateurs du réseau. Ces fonctions s’ouvriront après la validation par NAXA."}</p>
                {accessBlocked && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">Échéance enregistrée : {date(expiryDate)}. Contactez NAXA pour vérifier le règlement et la réactivation.</p>}
              </div>
            </div>

            {accessBlocked ? (
              <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-950">
                <p className="font-bold">Étapes de régularisation</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>Contactez l’équipe NAXA pour confirmer le montant et la période dus.</li>
                  <li>Faites confirmer le règlement par le canal autorisé.</li>
                  <li>NAXA vérifie la convention et rétablit les accès selon la procédure en vigueur.</li>
                </ol>
                <Link href="/promoteur/paiements" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0F6B3F] px-5 font-bold text-white">Suivre mes règlements et mes reçus</Link>
              </div>
            ) : statusUnavailable ? (
              <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <p className="font-bold">Accès fermé par précaution</p>
                <p className="mt-2">Les données nécessaires à la validation ne sont pas disponibles. Le tableau de bord et les actions d’administration restent inaccessibles jusqu’à une vérification réussie.</p>
              </div>
            ) : contractNeedsReview ? (
              <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <p className="font-bold">Contrôles contractuels requis</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Une seule convention doit être rattachée au Promoteur.</li>
                  <li>L’abonnement doit référencer cette convention et reprendre le même tarif.</li>
                  <li>L’architecture contractuelle doit correspondre à celle du compte Promoteur.</li>
                </ul>
                <p className="mt-3">Contactez NAXA pour finaliser la configuration. Aucun montant ni statut n’est modifié depuis cet écran.</p>
              </div>
            ) : (
              <ol className="mt-6 space-y-4">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-900">1</span>
                  <div><p className="font-bold">Compte Promoteur créé</p><p className="text-sm text-naxa-green-700">Votre accès est reconnu par NAXA.</p></div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-extrabold text-amber-900">2</span>
                  <div><p className="font-bold">Contrôle administratif</p><p className="text-sm text-naxa-green-700">NAXA vérifie les autorisations, le rattachement de la pharmacie, la convention, l’abonnement et l’architecture attribuée.</p></div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-sm font-extrabold text-naxa-green-700">3</span>
                  <div><p className="font-bold">Ouverture de l’espace</p><p className="text-sm text-naxa-green-700">Le réseau, la gestion de l’équipe et le Pilotage 360° seront accessibles après activation.</p></div>
                </li>
              </ol>
            )}
          </section>

          <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-none">
            <h2 className="font-extrabold">Pharmacie rattachée au dossier</h2>
            {(pharmacies ?? []).length ? (
              <ul className="mt-3 space-y-3">
                {(pharmacies ?? []).map((ph) => (
                  <li key={ph.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4">
                    <div><p className="font-bold">{ph.nom}</p><p className="text-sm text-naxa-green-700">{[ph.quartier, ph.ville].filter(Boolean).join(" · ") || "Localisation non renseignée"}</p></div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{activeLinkIds.has(ph.id) && ph.actif && ph.visible_recherche ? "Actif" : "En attente"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-naxa-green-700">Le rattachement de la pharmacie n’est pas encore visible. L’équipe NAXA doit finaliser le dossier.</p>}
            {!accessBlocked && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">La période d’essai de 14 jours commence lors de la validation du dossier, et non à cette étape d’attente.</p>}
          </section>

          <footer className="flex flex-wrap gap-3">
            <Link href="/connexion?espace=pharmacie" className="inline-flex min-h-11 items-center rounded-full bg-naxa-green-900 px-5 py-3 text-sm font-bold text-white">Retour à la connexion</Link>
            <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-bold">Accueil NAXA</Link>
          </footer>
        </div>
      </main>
    );
  }

  const activePharmacies = (pharmacies ?? []).filter(
    (ph) => activeLinkIds.has(ph.id) && ph.actif && ph.visible_recherche
  );
  const activePharmacyIds = new Set(activePharmacies.map((ph) => ph.id));
  const scopedIds = [...activePharmacyIds];
  const operationalCaisses = (caisses ?? []).filter((c) => c.pharmacie_id && activePharmacyIds.has(c.pharmacie_id));
  const securityRegistryEnabled = section === "securite";
  const [securityInstallationsResult, securityGatewaysResult, securityCamerasResult, securityConnectionsResult, securityEventsResult, securityDiscoveryCandidatesResult] = await Promise.all([
    securityRegistryEnabled && scopedIds.length
      ? adminDb.from("naxa_security_installations").select("id,pharmacie_id,status,legal_review_status,privacy_notice_status,updated_at").in("pharmacie_id", scopedIds)
      : Promise.resolve({ data: [], error: null }),
    securityRegistryEnabled && scopedIds.length
      ? adminDb.from("naxa_security_gateways").select("id,pharmacie_id,label,serial_number,firmware_version,tunnel_status,last_seen_at").in("pharmacie_id", scopedIds)
      : Promise.resolve({ data: [], error: null }),
    securityRegistryEnabled && scopedIds.length
      ? adminDb.from("naxa_security_cameras").select("id,pharmacie_id,status,model,zone_label").in("pharmacie_id", scopedIds)
      : Promise.resolve({ data: [], error: null }),
    securityRegistryEnabled && scopedIds.length
      ? adminDb.from("naxa_security_camera_connections").select("id,pharmacie_id,camera_id,adapter_key,protocol,connection_status,last_tested_at,last_error_code,is_primary").in("pharmacie_id", scopedIds)
      : Promise.resolve({ data: [], error: null }),
    securityRegistryEnabled && scopedIds.length
      ? adminDb.from("naxa_security_events").select("id,pharmacie_id,event_type,severity,status,summary,detected_at").in("pharmacie_id", scopedIds).order("detected_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [], error: null }),
    securityRegistryEnabled && scopedIds.length
      ? adminDb.from("naxa_security_camera_discovery_candidates")
          .select("id,pharmacie_id,gateway_id,device_id,source_address,device_types,device_scopes,endpoints,status,first_seen_at,last_seen_at")
          .in("pharmacie_id", scopedIds).eq("status", "pending")
          .order("last_seen_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const securityRegistryAvailable = !securityRegistryEnabled || [
    securityInstallationsResult.error, securityGatewaysResult.error,
    securityCamerasResult.error, securityConnectionsResult.error, securityEventsResult.error,
    securityDiscoveryCandidatesResult.error,
  ].every((error) => !error);

  if (section === "securite") {
    return (
      <main data-promoteur-section="securite" className="min-h-screen min-w-0 overflow-x-clip bg-naxa-green-50 text-naxa-green-900">
        <div className="mx-auto max-w-[1600px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-naxa-green-900 p-5 text-white sm:p-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-white/70">Espace Promoteur · Module dédié</p>
              <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Sécurité intelligente</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">Surveillance multi-caméras des pharmacies de votre réseau, dans le respect de votre périmètre d’accès.</p>
            </div>
            <Link href="/pharmacie/promoteur" className="inline-flex min-h-11 items-center rounded-full bg-[#FFE33D] px-4 py-2 text-sm font-extrabold text-naxa-green-900">← Tableau de bord</Link>
          </header>
          <PromoteurSecuriteIntelligente
            pharmacies={activePharmacies.map((ph) => ({ id: ph.id, nom: ph.nom, ville: ph.ville, quartier: ph.quartier }))}
            installations={securityInstallationsResult.data ?? []}
            gateways={securityGatewaysResult.data ?? []}
            cameras={securityCamerasResult.data ?? []}
            connections={securityConnectionsResult.data ?? []}
            discoveryCandidates={securityDiscoveryCandidatesResult.data ?? []}
            events={securityEventsResult.data ?? []}
            registryAvailable={securityRegistryAvailable}
          />
        </div>
        <PromoteurSectionStyles />
      </main>
    );
  }

  // Contrôle Promoteur 360° : sessions de service et indicateurs comptables strictement bornés
  // aux pharmacies actives, publiées et liées au Promoteur. Aucun détail de santé n'est chargé.
  const [
    pharmacistSessionsResult,
    stockSessionsResult,
    accountingPeriodsResult,
    accountingQueueResult,
    accountingEntriesResult,
    accountingPeriodsListResult,
    staffProfilesResult,
    networkSalesResult,
    professionalAssignmentsResult,
  ] = await Promise.all([
    scopedIds.length
      ? adminDb.from("pharmacien_service_sessions").select("id,pharmacie_id,pharmacien_id,started_at,ended_at").in("pharmacie_id", scopedIds).order("started_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    scopedIds.length
      ? adminDb.from("stock_service_sessions").select("id,pharmacie_id,gestionnaire_id,opened_at,closed_at").in("pharmacie_id", scopedIds).order("opened_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    scopedIds.length
      ? adminDb.from("compta_periodes").select("id", { count: "exact", head: true }).in("pharmacie_id", scopedIds).eq("statut", "ouverte")
      : Promise.resolve({ count: 0, error: null }),
    scopedIds.length
      ? adminDb.from("compta_evenement").select("id", { count: "exact", head: true }).in("pharmacie_id", scopedIds).in("statut", ["a_traiter", "erreur"])
      : Promise.resolve({ count: 0, error: null }),
    scopedIds.length
      ? adminDb.from("compta_ecriture").select("id", { count: "exact", head: true }).in("pharmacie_id", scopedIds).gte("date_ecriture", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      : Promise.resolve({ count: 0, error: null }),
    scopedIds.length
      ? adminDb.from("compta_periodes").select("id,pharmacie_id,date_debut,date_fin,statut").in("pharmacie_id", scopedIds).order("date_debut", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    scopedIds.length
      ? adminDb.from("profiles").select("id,first_name,last_name,username,pharmacie_id,fonction_interne,role").in("pharmacie_id", scopedIds)
      : Promise.resolve({ data: [], error: null }),
    scopedIds.length
      ? adminDb.from("v_reservations_ca").select("pharmacie_id,jour,ventes,total").in("pharmacie_id", scopedIds).gte("jour", new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
      : Promise.resolve({ data: [], error: null }),
    scopedIds.length
      ? adminDb.from("naxa_professional_assignments").select("id,profile_id,pharmacie_id,fonction,statut,motif,commence_at,expire_at,accorde_at,revoque_at,motif_revocation").eq("accorde_par", auth.user.id).in("pharmacie_id", scopedIds).order("accorde_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const serviceSessionSourceError = Boolean(ecartsCaisseError || pharmacistSessionsResult.error || stockSessionsResult.error || staffProfilesResult.error);
  const professionalAssignments = professionalAssignmentsResult.data ?? [];
  const assignmentProfileIds = [...new Set(professionalAssignments.map((assignment) => assignment.profile_id))];
  const { data: assignmentProfiles, error: assignmentProfilesError } = assignmentProfileIds.length
    ? await adminDb.from("profiles").select("id,first_name,last_name,username").in("id", assignmentProfileIds)
    : { data: [], error: null };
  const assignmentStaffById = new Map((assignmentProfiles ?? []).map((person) => [person.id, [person.first_name, person.last_name].filter(Boolean).join(" ") || person.username || "Personnel non identifié"] as const));
  const professionalAssignmentsError = Boolean(professionalAssignmentsResult.error || assignmentProfilesError);
  const accountingError = Boolean(accountingPeriodsResult.error || accountingQueueResult.error || accountingEntriesResult.error || accountingPeriodsListResult.error);
  const networkSalesError = Boolean(networkSalesResult.error);
  const salesByPharmacy = new Map<string, { ca: number; ventes: number }>();
  for (const row of networkSalesResult.data ?? []) { const current = salesByPharmacy.get(row.pharmacie_id) ?? { ca: 0, ventes: 0 }; current.ca += Number(row.total ?? 0); current.ventes += Number(row.ventes ?? 0); salesByPharmacy.set(row.pharmacie_id, current); }
  const staffProfiles = staffProfilesResult.data ?? [];
  const staffById = new Map(staffProfiles.map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.username || "Personnel"] as const));
  const periodsByPharmacy = new Map<string, { id: string; pharmacie_id: string; date_debut: string; date_fin: string; statut: string }>();
  for (const period of accountingPeriodsListResult.data ?? []) if (!periodsByPharmacy.has(period.pharmacie_id)) periodsByPharmacy.set(period.pharmacie_id, period);
  const pharmacistSessions = pharmacistSessionsResult.data ?? [];
  const stockSessions = stockSessionsResult.data ?? [];
  const staffSessions = [
    ...(caisseSessions ?? []).map((s) => ({ id: s.id, pharmacyId: caisseById.get(s.caisse_id)?.pharmacie_id ?? "", userId: s.ouvert_par, startedAt: s.ouvert_at, endedAt: s.cloture_at, role: "Caisse", label: caisseById.get(s.caisse_id)?.nom ?? "Caisse" })),
    ...pharmacistSessions.map((s) => ({ id: s.id, pharmacyId: s.pharmacie_id, userId: s.pharmacien_id, startedAt: s.started_at, endedAt: s.ended_at, role: "Pharmacien", label: "Service pharmacien" })),
    ...stockSessions.map((s) => ({ id: s.id, pharmacyId: s.pharmacie_id, userId: s.gestionnaire_id, startedAt: s.opened_at, endedAt: s.closed_at, role: "Gestionnaire de stock", label: "Service stock" })),
  ].filter((s) => activePharmacyIds.has(s.pharmacyId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50);
  const sessionProfileIds = [...new Set(staffSessions.map((session) => session.userId))];
  const { data: sessionProfiles, error: sessionProfilesError } = sessionProfileIds.length
    ? await adminDb.from("profiles").select("id,first_name,last_name,username").in("id", sessionProfileIds)
    : { data: [], error: null };
  const sessionStaffById = new Map([...staffProfiles, ...(sessionProfiles ?? [])].map((person) => [person.id, [person.first_name, person.last_name].filter(Boolean).join(" ") || person.username || "Personnel non identifié"] as const));
  const serviceSessionsError = Boolean(serviceSessionSourceError || sessionProfilesError);
  const openServiceCount = staffSessions.filter((s) => !s.endedAt).length;

  // Consolidation opérationnelle par poste : uniquement des agrégats et des profils
  // du réseau actif du Promoteur. Aucune donnée patient nominative n'est chargée ici.
  const [
    { data: teamRows, error: teamRowsError },
    stockLowResult,
    lotAlertsResult,
    pendingReservationsResult,
    pendingPrescriptionsResult,
    pendingPreparationsResult,
  ] = await Promise.all([
    scopedIds.length
      ? adminDb.from("profiles").select("id,role,fonction_interne,actif,pharmacie_id,niveau_interne,parent_profile_id").in("pharmacie_id", scopedIds)
      : Promise.resolve({ data: [] as {id:string;role:string;fonction_interne:string|null;actif:boolean;pharmacie_id:string|null;niveau_interne:number|null;parent_profile_id:string|null}[], error: null }),
    scopedIds.length ? adminDb.from("stocks").select("produit_id", { count: "exact", head: true }).in("pharmacie_id", scopedIds).lte("quantite", 5) : Promise.resolve({count:0,error:null}),
    scopedIds.length ? adminDb.from("stocks_lots").select("id", { count: "exact", head: true }).in("pharmacie_id", scopedIds).or("date_peremption.is.null,date_peremption.lte." + new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10) + ",bloque.eq.true") : Promise.resolve({count:0,error:null}),
    scopedIds.length ? adminDb.from("reservations").select("id", { count: "exact", head: true }).in("pharmacie_id", scopedIds).in("statut", ["en_attente", "confirmee"]) : Promise.resolve({count:0,error:null}),
    scopedIds.length ? adminDb.from("prescriptions").select("id", { count: "exact", head: true }).in("pharmacie_id", scopedIds).eq("source", "client").eq("statut", "en_attente") : Promise.resolve({count:0,error:null}),
    scopedIds.length ? adminDb.from("prescription_preparations").select("prescription_id", { count: "exact", head: true }).in("pharmacie_id", scopedIds).in("statut", ["soumise", "complement_requis"]) : Promise.resolve({count:0,error:null}),
  ]);
  const team = teamRows ?? [];
  const roleCounts = {
    responsables: team.filter((x) => x.actif && x.fonction_interne === "responsable").length,
    pharmaciens: team.filter((x) => x.actif && ["pharmacien", "pharmacien_assistant"].includes(x.fonction_interne ?? "")).length,
    stock: team.filter((x) => x.actif && ["gestionnaire_stock", "magasinier"].includes(x.fonction_interne ?? "")).length,
  };
  const roleControlError = Boolean(teamRowsError || stockLowResult.error || lotAlertsResult.error || pendingReservationsResult.error || pendingPrescriptionsResult.error || pendingPreparationsResult.error);
  const roleControl = {
    responsables: teamRowsError ? null : roleCounts.responsables,
    pharmaciens: teamRowsError ? null : roleCounts.pharmaciens,
    stock: teamRowsError ? null : roleCounts.stock,
    caisses: caissesError ? null : operationalCaisses.filter((x) => x.actif).length,
    stocksBas: stockLowResult.error ? null : stockLowResult.count ?? 0,
    lotsAControler: lotAlertsResult.error ? null : lotAlertsResult.count ?? 0,
    reservations: pendingReservationsResult.error ? null : pendingReservationsResult.count ?? 0,
    prescriptions: pendingPrescriptionsResult.error ? null : pendingPrescriptionsResult.count ?? 0,
    preparations: pendingPreparationsResult.error ? null : pendingPreparationsResult.count ?? 0,
  };
  const stats = (statsData ?? null) as Stats | null;
  const caissesActives = operationalCaisses.filter((x) => x.actif).length;
  const caissesBloquees = operationalCaisses.filter((x) => !x.actif).length;
  const alert = linksError || caissesError || pharmaciesError || statsError || ecartsCaisseError || pharmacistSessionsResult.error || stockSessionsResult.error || staffProfilesResult.error || accountingError || networkSalesError;
  const contractAmount = abonnement?.montant_mensuel ?? convention?.montant_mensuel ?? null;
  const contractStatus = abonnement?.statut ?? convention?.statut ?? null;
  const expiry = abonnement?.echeance ?? convention?.date_expiration ?? null;
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Promoteur";

  const kpis = [
    { title: "Pharmacies opérationnelles", value: String(activePharmacies.length), note: "Rattachement, activation et visibilité confirmés" },
    { title: "Caisses actives", value: caissesError ? "Indisponible" : String(caissesActives), note: caissesError ? "Source comptes Caisses indisponible" : caissesBloquees + " bloquée(s)" },
    { title: "Chiffre d’affaires · 30 jours", value: statsError || stats?.ca === undefined ? "Indisponible" : fcfa(stats.ca), note: "Vue canonique des réservations payées ou retirées" },
    { title: "Ruptures de stock", value: statsError || stats?.stock?.ruptures === undefined ? "Indisponible" : String(stats.stock.ruptures), note: "Pilotage agrégé du réseau autorisé" },
    { title: "Alertes", value: statsError || stats?.alertes === undefined ? "Indisponible" : String(stats.alertes), note: "Alertes non lues de la source de pilotage" },
  ];

  return (
    <main data-promoteur-section={section} className="min-h-screen min-w-0 overflow-x-clip bg-naxa-green-50 text-naxa-green-900">
      <PromoteurHashRedirect />

      <div className="min-h-screen min-w-0">
      <div className="mx-auto max-w-[1600px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header id="accueil" className="promoteur-card flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-naxa-green-900 p-6 text-white sm:p-8 lg:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-white/70">{activePharmacies[0]?.nom ?? "Pharmacie non renseignée"} · Niveau N{profile.niveau_interne ?? 1}</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Espace Promoteur</h1>
            <p className="mt-1 text-sm text-white/80">Bonjour <strong className="text-base font-extrabold">{displayName}</strong>. Ceci est votre espace de pilotage.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EspaceNaxaSwitcher current="promoteur" />
            <Link className="rounded-full bg-[#FFE33D] px-4 py-2 text-sm font-bold text-naxa-green-900" href="/promoteur/paiements">Mes règlements</Link>
            <Link className="rounded-full border border-white/50 px-4 py-2 text-sm font-bold" href="/pharmacie?vue=operation">Ouvrir les opérations</Link>
            <Link className="rounded-full bg-[#FFE33D] px-4 py-2 text-sm font-bold text-naxa-green-900" href="/pharmacie/caisses">Gérer l’équipe</Link>
             <Link className="rounded-full border border-white px-4 py-2 text-sm font-bold text-white" href="/pharmacie/affectations">Affectations multiples</Link>
          </div>
        </header>
        <div className="promoteur-bento-grid min-w-0">
        <AvisRappelsLotsPromoteur />
        <RapportsALaDemande variant="default" />

        {alert && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Certaines données ne sont pas disponibles. Les indicateurs indisponibles sont affichés sans inventer de valeurs.</p>}

        <section className="promoteur-kpis grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {kpis.map((k, index) => <article key={k.title} className={index === 0 ? "promoteur-card relative rounded-3xl bg-naxa-green-900 p-5 text-white" : "promoteur-card relative rounded-3xl border border-naxa-green-100 bg-white p-5"}>
            {index !== 0 && <span aria-hidden="true" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-naxa-green-50 text-naxa-green-700">{["", "♙", "↗", "◇", "⚑"][index]}</span>}
            <p className={index === 0 ? "pr-3 text-sm font-semibold text-white" : "pr-10 text-sm font-semibold text-naxa-green-700"}>{k.title}</p>
            <PromoteurKpiValue value={k.value} className="mt-3 block text-2xl font-extrabold tabular-nums" />
            <p className={index === 0 ? "mt-2 text-xs leading-5 text-white" : "mt-2 text-xs leading-5 text-naxa-green-700"}>{k.note}</p>
          </article>)}
        </section>

        <div aria-label="Palette Promoteur" className="promoteur-palette flex h-2 overflow-hidden rounded-full border border-slate-200" title="Palette visuelle : vert 40 %, jaune canari 25 %, blanc 15 %, orange canari 10 %, bleu canari 5 %, rouge 5 %">
          <span className="promoteur-palette-fill" style={{ width: "40%", backgroundColor: "#0A6B3A" }} />
          <span className="promoteur-palette-fill" style={{ width: "25%", backgroundColor: "#FFE33D" }} />
          <span className="promoteur-palette-fill" style={{ width: "15%", backgroundColor: "#FFFFFF" }} />
          <span className="promoteur-palette-fill" style={{ width: "10%", backgroundColor: "#FFB000" }} />
          <span className="promoteur-palette-fill" style={{ width: "5%", backgroundColor: "#3DBBFF" }} />
          <span className="promoteur-palette-fill" style={{ width: "5%", backgroundColor: "#DC2626" }} />
        </div>

        <section id="sessions-personnel" className="promoteur-card xl:col-span-12 rounded-3xl border border-naxa-canari bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold">Prise / fin de service — réseau</h2><p className="mt-1 text-sm text-naxa-green-700">Historique récent des sessions Caisse, Pharmacien et Gestionnaire de stock, limité aux pharmacies actives du Promoteur.</p></div>
            <span className="rounded-full bg-[#FFE33D] px-3 py-1 text-xs font-extrabold text-naxa-green-900">{serviceSessionsError ? "Indisponible" : `${openServiceCount} service(s) ouvert(s)`}</span>
          </div>
          {serviceSessionsError ? <p role="status" className="mt-3 rounded-xl bg-orange-50 p-3 text-sm text-orange-950">Les sessions de service ne peuvent pas toutes être chargées. Aucun chiffre incomplet n'est présenté comme un résultat complet.</p> : !staffSessions.length ? <p className="mt-3 rounded-xl bg-[#F2FAF5] p-3 text-sm text-naxa-green-700">Aucune session de service disponible pour les postes dont le suivi est configuré.</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead><tr className="border-b border-slate-200 text-naxa-green-700"><th className="p-2">Poste / service</th><th className="p-2">Personnel</th><th className="p-2">Prise</th><th className="p-2">Fin</th><th className="p-2">État</th></tr></thead>
                <tbody>{staffSessions.map((s) => <tr key={s.role + s.id} className="border-b border-slate-100">
                  <td className="p-2"><span className="font-bold">{s.role}</span><span className="block text-xs text-naxa-green-700">{s.label}</span></td>
                  <td className="p-2">{sessionStaffById.get(s.userId) ?? "Personnel non identifié"}</td>
                  <td className="p-2 tabular-nums">{dateTime(s.startedAt)}</td><td className="p-2 tabular-nums">{dateTime(s.endedAt)}</td>
                  <td className="p-2"><span className={s.endedAt ? "rounded-full bg-[#F2FAF5] px-2 py-1 text-xs font-bold text-naxa-green-900" : "rounded-full bg-[#FFE33D] px-2 py-1 text-xs font-bold text-naxa-green-900"}>{s.endedAt ? "Clôturé" : "Ouvert"}</span></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-naxa-green-700">Le suivi est affiché uniquement pour les postes disposant d'une table de session. Les rôles sans journal de service ne sont pas inventés.</p>
        </section>

        <section id="affectations-personnel" className="promoteur-card xl:col-span-12 rounded-3xl border border-naxa-green-100 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold">Affectations du personnel — détail nominatif</h2><p className="mt-1 text-sm text-naxa-green-700">Affectations accordées par votre compte dans les pharmacies actives de votre réseau, y compris les révocations récentes.</p></div>
            <span className="rounded-full bg-[#F2FAF5] px-3 py-1 text-xs font-extrabold text-naxa-green-900">{professionalAssignmentsError ? "Indisponible" : professionalAssignments.length + " affectation(s)"}</span>
          </div>
          {professionalAssignmentsError ? <p role="status" className="mt-3 rounded-xl bg-orange-50 p-3 text-sm text-orange-950">Le détail des affectations n’a pas pu être chargé. Aucune liste partielle n’est présentée comme complète.</p> : !professionalAssignments.length ? <p className="mt-3 rounded-xl bg-[#F2FAF5] p-3 text-sm text-naxa-green-700">Aucune affectation accordée dans le périmètre chargé.</p> : (
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-naxa-green-700"><th className="p-2">Personnel</th><th className="p-2">Pharmacie</th><th className="p-2">Fonction</th><th className="p-2">Début</th><th className="p-2">Fin prévue</th><th className="p-2">Statut</th><th className="p-2">Révocation</th></tr></thead>
              <tbody>{professionalAssignments.map((a) => <tr key={a.id} className="border-b border-slate-100">
                <td className="p-2 font-semibold">{assignmentStaffById.get(a.profile_id) ?? "Personnel non identifié"}</td>
                <td className="p-2">{(pharmacies ?? []).find((ph) => ph.id === a.pharmacie_id)?.nom ?? "Pharmacie du réseau"}</td>
                <td className="p-2">{a.fonction}</td><td className="p-2 tabular-nums">{dateTime(a.commence_at)}</td><td className="p-2 tabular-nums">{dateTime(a.expire_at)}</td>
                <td className="p-2">{a.statut === "active" ? "Active" : "Révoquée"}</td><td className="p-2 tabular-nums">{dateTime(a.revoque_at)}</td>
              </tr>)}</tbody>
            </table></div>
          )}
        </section>

<section id="pharmaciens" className="promoteur-card xl:col-span-12 rounded-3xl border border-naxa-canari bg-white p-5 sm:p-6"><h2 className="text-lg font-extrabold">Pharmaciens</h2><p className="mt-1 text-sm text-naxa-green-700">Supervision agrégée. Aucun nom de patient, contenu d’ordonnance ni détail de dispensation n’est affiché.</p><p className="mt-3 text-sm">Comptes actifs : <strong>{roleControl.pharmaciens===null?"Indisponible":roleControl.pharmaciens}</strong> · Ordonnances en attente : <strong>{roleControl.prescriptions===null?"Indisponible":roleControl.prescriptions}</strong></p>{serviceSessionsError?<p className="mt-3 text-sm">Historique des services pharmacien indisponible.</p>:<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr><th className="p-2">Poste / service</th><th className="p-2">Personnel</th><th className="p-2">Prise</th><th className="p-2">Fin</th><th className="p-2">État</th></tr></thead><tbody>{staffSessions.filter(s=>s.role==="Pharmacien").map(s=><tr key={s.id}><td className="p-2">Pharmacien</td><td className="p-2">{sessionStaffById.get(s.userId)??"Personnel non identifié"}</td><td className="p-2">{dateTime(s.startedAt)}</td><td className="p-2">{dateTime(s.endedAt)}</td><td className="p-2">{s.endedAt?"Clôturé":"Ouvert"}</td></tr>)}</tbody></table></div>}</section>
        <section id="clotures-caisses" className="promoteur-card xl:col-span-12 rounded-3xl border border-naxa-canari bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold">Clôtures de caisse et soldes de fin de service</h2><p className="mt-1 text-sm text-naxa-green-700">Inclut les clôtures sans écart : le solde théorique et le montant compté sont visibles même lorsque l'écart est nul.</p></div>
            <span className="rounded-full bg-[#FFE33D] px-3 py-1 text-xs font-extrabold text-naxa-green-900">{ecartsCaisseError ? "Indisponible" : `${(caisseSessions ?? []).filter((s) => Boolean(s.cloture_at)).length} clôture(s) récentes`}</span>
          </div>
          {ecartsCaisseError ? <p role="status" className="mt-3 rounded-xl bg-orange-50 p-3 text-sm text-orange-950">L'historique des sessions de caisse est indisponible.</p> : !(caisseSessions ?? []).some((s) => s.cloture_at) ? <p className="mt-3 rounded-xl bg-[#F2FAF5] p-3 text-sm text-naxa-green-700">Aucune clôture récente dans le périmètre autorisé.</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead><tr className="border-b border-slate-200 text-naxa-green-700"><th className="p-2">Caisse</th><th className="p-2">Clôture</th><th className="p-2">Théorique</th><th className="p-2">Compté</th><th className="p-2">Écart</th></tr></thead>
                <tbody>{(caisseSessions ?? []).filter((s) => s.cloture_at).slice(0, 30).map((s) => <tr key={s.id} className="border-b border-slate-100">
                  <td className="p-2 font-bold">{caisseById.get(s.caisse_id)?.nom ?? "Caisse"}</td><td className="p-2">{dateTime(s.cloture_at)}</td><td className="p-2 tabular-nums">{fcfa(s.total_theorique)}</td><td className="p-2 tabular-nums">{s.total_compte === null ? "Non renseigné" : fcfa(s.total_compte)}</td>
                  <td className="p-2"><span className={Number(s.ecart ?? 0) === 0 ? "rounded-full bg-[#F2FAF5] px-2 py-1 text-xs font-bold text-naxa-green-900" : Number(s.ecart) < 0 ? "rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-900" : "rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-900"}>{Number(s.ecart ?? 0) > 0 ? "+" : ""}{fcfa(Number(s.ecart ?? 0))}</span></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        <section id="comptabilite-reseau" className="promoteur-card xl:col-span-6 rounded-3xl border border-naxa-green-100 bg-white p-5 sm:p-6">
          <div><h2 className="text-lg font-extrabold">Contrôle comptable — réseau</h2><p className="mt-1 text-sm text-naxa-green-700">Indicateurs de traitement et de clôture, en lecture seule. Ils ne remplacent pas les états comptables validés.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: "Périodes comptables ouvertes", value: accountingError ? "Indisponible" : String(accountingPeriodsResult.count ?? 0), color: "border-[#3DBBFF] bg-sky-50" },
              { title: "Événements à traiter / en erreur", value: accountingError ? "Indisponible" : String(accountingQueueResult.count ?? 0), color: "border-[#FFB000] bg-orange-50" },
              { title: "Écritures des 30 derniers jours", value: accountingError ? "Indisponible" : String(accountingEntriesResult.count ?? 0), color: "border-emerald-700 bg-[#F2FAF5]" },
            ].map((item) => <article key={item.title} className={`rounded-2xl border p-4 shadow-none ${item.color}`}><p className="text-sm font-semibold text-naxa-green-700">{item.title}</p><p className="mt-2 text-2xl font-black tabular-nums">{item.value}</p></article>)}
          </div>
          {accountingError && <p role="status" className="rounded-xl bg-orange-50 p-3 text-sm text-orange-950">Une source comptable est indisponible ; les indicateurs comptables sont marqués « Indisponible ».</p>}
        </section>

        <section id="comparaison-pharmacies" className="promoteur-card xl:col-span-6 rounded-3xl border border-naxa-green-100 bg-white p-5 sm:p-6">
          <div><h2 className="text-lg font-extrabold">Comparaison par pharmacie et période</h2><p className="mt-1 text-sm text-naxa-green-700">Lecture comparative du statut de clôture comptable par pharmacie. Les périodes affichées proviennent du socle comptable ; aucune marge historique n'est calculée.</p></div>
          {!activePharmacies.length ? <p className="mt-3 rounded-xl bg-[#F2FAF5] p-3 text-sm text-naxa-green-700">Aucune pharmacie opérationnelle dans le périmètre.</p> : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {activePharmacies.map((ph) => {
                const period = periodsByPharmacy.get(ph.id);
                const caisseCount = operationalCaisses.filter((x) => x.pharmacie_id === ph.id && x.actif).length;
                const sessionCount = staffSessions.filter((s) => s.pharmacyId === ph.id && !s.endedAt).length;
                return <article key={ph.id} className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-extrabold">{ph.nom}</h3>
                  <p className="mt-2 text-sm text-naxa-green-700">CA qualifié · 30 jours : <strong>{networkSalesError ? "Indisponible" : fcfa(salesByPharmacy.get(ph.id)?.ca ?? 0)}</strong></p>
                  <p className="mt-1 text-sm text-naxa-green-700">Ventes qualifiées · 30 jours : <strong>{networkSalesError ? "Indisponible" : String(salesByPharmacy.get(ph.id)?.ventes ?? 0)}</strong></p>
                  <p className="mt-1 text-sm text-naxa-green-700">Caisses actives : <strong>{caissesError ? "Indisponible" : caisseCount}</strong></p>
                  <p className="mt-1 text-sm text-naxa-green-700">Services ouverts : <strong>{serviceSessionsError ? "Indisponible" : sessionCount}</strong></p>
                  <p className="mt-1 text-sm text-naxa-green-700">Période comptable la plus récente : <strong>{accountingError ? "Indisponible" : period ? `${date(period.date_debut)} – ${date(period.date_fin)} · ${period.statut}` : "Aucune période configurée"}</strong></p></article>;
              })}
            </div>
          )}
        </section>

        <section id="controle-postes" className="promoteur-card xl:col-span-12 rounded-3xl border border-naxa-green-100 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-extrabold">Contrôle opérationnel par poste</h2><p className="mt-1 text-sm text-naxa-green-700">Indicateurs agrégés des comptes rattachés aux pharmacies actives. Les dossiers de santé nominatifs ne sont jamais affichés ici.</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">Périmètre : {activePharmacies.length} pharmacie(s)</span>
          </div>
          {roleControlError && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Une ou plusieurs sources de poste sont indisponibles. Les valeurs concernées sont affichées « Indisponible », pas comme des zéros.</p>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { title: "Responsables", people: roleControl.responsables, metric: "Comptes actifs", detail: "Supervision des Caisses et opérations du périmètre délégué", href: "/pharmacie/pilotage" },
              { title: "Caisses", people: roleControl.caisses, metric: "Comptes actifs", detail: `Ventes, sessions et écarts à vérifier parmi les dernières clôtures chargées : ${ecartsCaisseError ? "indisponible" : (ecartsCaisse ?? []).filter((e) => e.ecart_statut === "a_verifier").length}`, href: "/pharmacie/caisses" },
              { title: "Pharmaciens", people: roleControl.pharmaciens, metric: "Comptes actifs", detail: roleControl.prescriptions === null ? "Ordonnances en attente : indisponible" : `Ordonnances à contrôler : ${roleControl.prescriptions}`, href: "/pharmacie/promoteur/services#pharmaciens" },
              { title: "Gestionnaires de stock / magasiniers", people: roleControl.stock, metric: "Comptes actifs", detail: roleControl.stocksBas === null ? "Stocks bas : indisponible" : `Références à stock bas : ${roleControl.stocksBas}`, href: "/pharmacie/gestionnaire-stock" },
              { title: "Réservations Marketplace", people: null, metric: "À traiter", detail: roleControl.reservations === null ? "Source réservations indisponible" : `${roleControl.reservations} réservation(s) en attente ou confirmée(s)`, href: "/pharmacie?vue=operation" },
              { title: "Lots & préparations", people: null, metric: "Points de contrôle", detail: roleControl.lotsAControler === null || roleControl.preparations === null ? "Source lots ou préparations indisponible" : `${roleControl.lotsAControler} lot(s) à contrôler · ${roleControl.preparations} préparation(s) en cours`, href: "/pharmacie/gestionnaire-stock/lots-peremptions" },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-none">
                <div className="flex items-start justify-between gap-3"><h3 className="font-extrabold">{item.title}</h3><span className="rounded-full bg-[#F2FAF5] px-2 py-1 text-xs font-semibold text-naxa-green-900">{item.metric}</span></div>
                <p className="mt-3 text-2xl font-black tabular-nums">{item.people === null ? "—" : item.people === undefined ? "Indisponible" : String(item.people)}</p>
                <p className="mt-1 text-sm leading-5 text-naxa-green-700">{item.detail}</p>
                <Link className="mt-3 inline-flex min-h-10 items-center rounded-full border border-emerald-200 px-3 py-2 text-sm font-bold text-naxa-green-900 hover:bg-[#F2FAF5]" href={item.href}>Ouvrir le module →</Link>
              </article>
            ))}
          </div>
          <p className="text-xs leading-5 text-naxa-green-700">Les chiffres de stock bas utilisent le seuil opérationnel déjà utilisé par le poste Gestionnaire de stock (quantité ≤ 5). Ce seuil décrit une alerte de travail, pas une règle réglementaire. Les métriques de marge et de rentabilité ne sont pas affichées tant que le coût historique au moment de la vente n’est pas disponible.</p>
        </section>

<section id="actions-rapides" className="promoteur-card rounded-3xl border border-naxa-green-100 bg-white p-5"><h2 className="text-lg font-extrabold">Actions rapides</h2><div className="mt-3 flex flex-wrap gap-2"><Link className="btn btn-vert" href="/pharmacie/caisses">Gestion des Caisses</Link><Link className="btn btn-clair" href="/pharmacie/affectations">Affectations multiples</Link><Link className="btn btn-clair" href="/pharmacie/pilotage">Pilotage du réseau</Link><Link className="btn btn-clair" href="/pharmacie/pilotage/rapports">Rapports</Link><Link className="btn btn-clair" href="/pharmacie/promoteur/livraisons">Commissions de livraison</Link></div></section>
        <section id="ecarts-caisse" className="promoteur-card xl:col-span-6 rounded-3xl border border-naxa-canari bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">Écarts de caisse à vérifier</h2>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{(ecartsCaisse ?? []).filter((x) => x.ecart_statut === "a_verifier").length} à vérifier</span>
          </div>
          <p className="mt-1 text-sm text-naxa-green-700">Les écarts clôturés sont conservés avec leur justification. Cet écran est en lecture seule : une correction comptable doit être une opération séparée et auditée.</p>
          {!ecartsCaisse?.length ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Aucun écart de clôture enregistré sur le réseau actif.</p> : <ul className="mt-3 space-y-2">
            {ecartsCaisse.map((e) => {
              const caisse = caisseById.get(e.caisse_id);
              return <li key={e.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-bold">{caisse?.nom ?? "Caisse"} · {date(e.cloture_at)}</p><p className="text-sm text-naxa-green-700">Théorique : {fcfa(e.total_theorique)} · Compté : {e.total_compte === null ? "Non renseigné" : fcfa(e.total_compte)}</p>
                    {e.ecart_justification && <p className="mt-1 text-sm">Justification : {e.ecart_justification}</p>}
                  </div><div className="text-right"><p className={Number(e.ecart) < 0 ? "font-extrabold text-red-700" : "font-extrabold text-amber-800"}>{Number(e.ecart) > 0 ? "+" : ""}{fcfa(Number(e.ecart))}</p><p className="text-xs text-naxa-green-700">{e.ecart_statut === "a_verifier" ? "À vérifier" : e.ecart_statut}</p></div>
                </div>
              </li>;
            })}
          </ul>}
        </section>

        <section id="reseau" className="promoteur-card xl:col-span-12 grid gap-4 rounded-3xl border border-naxa-green-100 bg-white p-4 sm:p-6 lg:grid-cols-[1.4fr_.8fr]">
          <article className="rounded-3xl border border-naxa-green-100 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-lg font-extrabold">Mon réseau</h2><p className="text-sm text-naxa-green-700">Les pharmacies sont attribuées par NAXA. Chaque pharmacie garde son propre stock et sa propre identité.</p></div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold">{activePharmacies.length} active(s)</span>
            </div>
            {!activePharmacies.length ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-naxa-green-700">Aucune pharmacie opérationnelle n’est disponible sur votre périmètre. NAXA doit finaliser le rattachement et l’activation avant toute administration.</div> : (
              <div className="mt-4 space-y-3">
                {activePharmacies.map((ph) => {
                  const caisseCount = (caisses ?? []).filter((c) => c.pharmacie_id === ph.id).length;
                  const activeCount = (caisses ?? []).filter((c) => c.pharmacie_id === ph.id && c.actif).length;
                  return <article key={ph.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h3 className="font-extrabold">{ph.nom}</h3><p className="text-sm text-naxa-green-700">{[ph.quartier, ph.ville].filter(Boolean).join(" · ") || "Localisation non renseignée"}</p></div>
                      <span className={ph.actif ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900" : "rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-900"}>{ph.actif ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-naxa-green-700">
                      <span className="rounded-full bg-slate-100 px-3 py-1">{activeCount}/{caisseCount} Caisse(s) active(s)</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{ph.de_garde ? "De garde" : "Hors garde"}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">Stock actualisé : {date(ph.stock_updated_at)}</span>
                    </div>
                    <Link className="mt-3 inline-flex min-h-11 items-center rounded-full bg-naxa-green-900 px-4 py-2 text-sm font-bold text-white" href={`/pharmacie?vue=operation&pharmacie=${encodeURIComponent(ph.id)}`}>Ouvrir cette pharmacie</Link>
                  </article>;
                })}
              </div>
            )}
          </article>

          <aside className="space-y-4">
            <article id="convention" className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-none">
              <h2 className="text-lg font-extrabold">Convention et abonnement</h2>
              {contractStatus ? <>
                <p className="mt-3 text-sm text-naxa-green-700">État commercial</p>
                <p className={contractStatus === "actif" || contractStatus === "active" ? "font-extrabold text-emerald-800" : "font-extrabold text-red-700"}>{contractStatus.toUpperCase()}</p>
                <p className="mt-2 text-sm text-naxa-green-700">Tarif mensuel</p><p className="font-bold">{contractAmount ? fcfa(contractAmount) : "Non configuré"}</p>
                <p className="mt-2 text-sm text-naxa-green-700">Échéance</p><p className="font-bold">{date(expiry)}</p>
                {abonnement?.bloque_le && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">Blocage commercial enregistré le {date(abonnement.bloque_le)}. Contactez NAXA pour régulariser.</p>}
                {abonnement?.rappel_5j_envoye_at && <p className="mt-2 text-xs text-amber-800">Un rappel d’échéance a été enregistré le {date(abonnement.rappel_5j_envoye_at)}.</p>}
              </> : <p className="mt-3 text-sm text-naxa-green-700">Aucune convention ou aucun abonnement n’est configuré pour ce Promoteur. Contactez l’équipe NAXA pour finaliser l’attribution.</p>}
              <p className="mt-3 text-xs text-naxa-green-700">La modification du tarif et la réactivation commerciale sont réservées à NAXA. Cet écran est en lecture seule.</p>
            </article>

            <article className="rounded-3xl border border-naxa-green-100 bg-white p-5">
              <h2 className="text-lg font-extrabold">Actions rapides</h2>
              <div className="mt-3 grid gap-2">
                <Link className="btn btn-vert text-center" href="/pharmacie/caisses">Créer / bloquer / réactiver une Caisse</Link>
                <Link className="btn btn-clair text-center" href="/pharmacie/pilotage">Analyser l’activité du réseau</Link>
                <Link className="btn btn-clair text-center" href="/pharmacie/pilotage/rapports">Consulter les rapports disponibles</Link>
                <Link className="btn btn-clair text-center" href="/pharmacie">Stock, réservations et garde de la pharmacie principale</Link>
              </div>
            </article>
          </aside>
        </section>

        <section className="space-y-3">
          {geoStatus === "mis-a-jour" && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Coordonnées enregistrées. La position est en attente de vérification par NAXA.</p>}
          {geoStatus === "perimetre" && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">Modification refusée : pharmacie hors de votre réseau actif, compte inactif ou coordonnées hors du Cameroun.</p>}
          {geoStatus === "journal" && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">La position a été enregistrée mais le journal d’audit n’a pas été confirmé. Contactez NAXA avant une nouvelle modification.</p>}
          {geoStatus === "echec" && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">La géolocalisation n’a pas pu être enregistrée.</p>}
        </section>
        <PromoteurGeolocalisationReseau pharmacies={(pharmacies ?? []).filter(ph => activeLinkIds.has(ph.id) && ph.archivee_le === null).map(ph => ({
          id: ph.id, nom: ph.nom, ville: ph.ville, quartier: ph.quartier, lat: ph.lat, lng: ph.lng,
          geo_statut: ph.geo_statut, geo_source_type: ph.geo_source_type, geo_mise_a_jour: ph.geo_mise_a_jour,
          geo_verifiee_le: ph.geo_verifiee_le, archivee_le: ph.archivee_le,
        }))}/>
        <div id="securite" className="promoteur-card xl:col-span-12 space-y-4 rounded-3xl border border-naxa-green-100 bg-white p-4 sm:p-6">
          <CaisseSecurityManager cashiers={(caisses ?? []).filter((c) => c.actif === true && c.pharmacie_id && activePharmacyIds.has(c.pharmacie_id)).map((c) => ({ id: c.id, username: c.username ?? null, first_name: c.first_name ?? null, last_name: c.last_name ?? null, pharmacie_id: c.pharmacie_id ?? null, actif: true }))} />
          {section === "securite" && <PromoteurSecuriteIntelligente
            pharmacies={activePharmacies.map((ph) => ({ id: ph.id, nom: ph.nom, ville: ph.ville, quartier: ph.quartier }))}
            installations={securityInstallationsResult.data ?? []}
            gateways={securityGatewaysResult.data ?? []}
            cameras={securityCamerasResult.data ?? []}
            connections={securityConnectionsResult.data ?? []}
            discoveryCandidates={securityDiscoveryCandidatesResult.data ?? []}
            events={securityEventsResult.data ?? []}
            registryAvailable={securityRegistryAvailable}
          />}
          <section id="configuration" className="promoteur-card rounded-3xl border border-naxa-green-100 bg-white p-5">
            <h2 className="text-lg font-extrabold">Configuration et périmètre contractuel</h2>
            <p className="mt-2 text-sm leading-6 text-naxa-green-700">Architecture attribuée par NAXA : <strong>{convention?.architecture_code ?? profile.architecture_code ?? "Non renseignée"}</strong>. Le Promoteur peut gérer les Caisses et déléguer uniquement les privilèges compatibles, actifs et délégables. Les paramètres de convention et les droits de gouvernance ne sont pas modifiables depuis cet espace.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="btn btn-clair" href="/pharmacie/caisses/privileges">Consulter les droits déléguables</Link>
              <Link className="btn btn-clair" href="/pharmacie/promoteur/aide">Centre d’aide</Link>
            </div>
            <div className="mt-5"><PromoteurPasswordForm /></div>
          </section>
          <section id="profil" className="promoteur-card rounded-3xl border border-naxa-green-100 bg-white p-5">
            <h2 className="text-lg font-extrabold">Mon profil Promoteur</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#F2FAF5] p-3"><dt>Nom affiché</dt><dd className="font-bold">{displayName||"Non renseigné"}</dd></div><div className="rounded-xl bg-[#F2FAF5] p-3"><dt>Rôle et niveau</dt><dd className="font-bold">Promoteur · N{profile.niveau_interne??1}</dd></div><div className="rounded-xl bg-[#F2FAF5] p-3"><dt>État du compte</dt><dd className="font-bold">{profile.actif?"Actif":"En attente"}</dd></div><div className="rounded-xl bg-[#F2FAF5] p-3"><dt>Identifiant</dt><dd className="font-bold">{profile.username||"Non renseigné"}</dd></div><div className="rounded-xl bg-[#F2FAF5] p-3"><dt>Téléphone</dt><dd className="font-bold">{profile.phone||"Non renseigné"}</dd></div><div className="rounded-xl bg-[#F2FAF5] p-3"><dt>E-mail de connexion</dt><dd className="break-all font-bold">{auth.user.email||"Non renseigné"}</dd></div><div className="rounded-xl bg-[#F2FAF5] p-3"><dt>Code d’architecture</dt><dd className="font-bold">{profile.architecture_code||"Non renseigné"}</dd></div><div className="rounded-xl bg-[#F2FAF5] p-3"><dt>Pharmacies rattachées</dt><dd className="font-bold">{(links??[]).length}</dd></div></dl><h3 className="mt-4 font-bold">Historique des rattachements</h3>{(links??[]).map(link=><p key={link.pharmacie_id} className="mt-2 rounded-xl border p-3 text-sm">{(pharmacies??[]).find(ph=>ph.id===link.pharmacie_id)?.nom??"Pharmacie non renseignée"} · Rattachée le {date(link.created_at)}</p>)}<div className="mt-4"><PromoteurLogoManager pharmacies={(pharmacies ?? []).filter(ph => activeLinkIds.has(ph.id) && ph.actif).map(ph => ({id: ph.id, nom: ph.nom}))} /></div>
          </section>
        </div>

        <section className="promoteur-card xl:col-span-12 rounded-3xl border border-naxa-green-100 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-extrabold">Limites de gouvernance</h2>
          <p className="mt-2 text-sm leading-6 text-naxa-green-700">Le Promoteur ne peut pas créer une nouvelle pharmacie, modifier sa convention, changer le tarif, réactiver commercialement un réseau bloqué ni s’attribuer des privilèges. Ces actions restent sous contrôle de NAXA. Les pharmacies hors réseau ne sont jamais affichées comme administrables.</p>
        </section>
          </div>
        </div>
      </div><PromoteurSectionStyles />
    </main>
  );
}
export default function EspacePromoteur(){return <PromoteurDashboard/>;}
