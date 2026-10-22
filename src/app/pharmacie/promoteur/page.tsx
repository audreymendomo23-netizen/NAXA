import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { fcfa } from "@/lib/ranking";
import { CaisseSecurityManager } from "@/components/pharmacie/CaisseSecurityManager";
import { AvisRappelsLotsPromoteur } from "@/components/pharmacie/AvisRappelsLotsPromoteur";

type Stats = {
  pharmacies?: { total?: number; actives?: number; inactives?: number };
  recherches?: { total?: number; sans_resultat?: number };
  entonnoir?: { recherches?: number; fiches_vues?: number; paniers?: number; reservations?: number; ventes?: number };
  ca?: number;
  stock?: { produits_en_stock?: number; ruptures?: number };
  alertes?: number;
  serie?: { jour: string; recherches: number; reservations: number; ventes: number }[];
};

const date = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString("fr-FR") : "Non renseignée";\nconst dateTime = (v: string | null | undefined) => v ? new Date(v).toLocaleString("fr-FR") : "Non renseignée";

export default async function EspacePromoteur() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/promoteur");

  const { data: profile } = await sb.from("profiles")
    .select("id,role,actif,first_name,last_name,pharmacie_id,architecture_code")
    .eq("id", auth.user.id).single();
  if (profile?.role !== "promoteur") redirect("/");
  const adminDb = supabaseAdmin();

  const { data: links, error: linksError } = await adminDb.from("promoteur_pharmacies")
    .select("pharmacie_id,actif,created_at")
    .eq("promoteur_id", auth.user.id);

  const ids = [...new Set((links ?? []).map((x) => x.pharmacie_id))];
  const { data: caisses, error: caissesError } = ids.length
    ? await adminDb.from("profiles")
        .select("id,username,first_name,last_name,pharmacie_id,actif,parent_profile_id,niveau_interne,fonction_interne")
        .in("pharmacie_id", ids)
        .eq("role", "caisse")
    : { data: [] as {id:string;username:string|null;first_name:string|null;last_name:string|null;pharmacie_id:string|null;actif:boolean;parent_profile_id:string|null;niveau_interne:number|null;fonction_interne:string|null}[], error: null };
  const { data: pharmacies, error: pharmaciesError } = ids.length
    ? await adminDb.from("pharmacies").select("id,nom,ville,quartier,actif,visible_recherche,de_garde,stock_updated_at").in("id", ids).order("nom")
    : { data: [] as { id: string; nom: string; ville: string | null; quartier: string | null; actif: boolean; visible_recherche: boolean; de_garde: boolean; stock_updated_at: string | null }[], error: null };

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
  const [
    { data: convention, error: conventionError },
    { data: abonnement, error: abonnementError },
  ] = await Promise.all([
    adminDb.from("conventions_promoteurs")
      .select("id,architecture_code,montant_mensuel,date_paiement,date_expiration,statut")
      .eq("promoteur_id", auth.user.id).maybeSingle(),
    adminDb.from("abonnements_promoteurs")
      .select("id,convention_id,montant_mensuel,debut,echeance,statut,bloque_le,reactive_le,rappel_5j_envoye_at")
      .eq("promoteur_id", auth.user.id).maybeSingle(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const activeLinkIds = new Set((links ?? []).filter((link) => link.actif).map((link) => link.pharmacie_id));
  const hasOperationalNetwork = (pharmacies ?? []).some(
    (ph) => activeLinkIds.has(ph.id) && ph.actif && ph.visible_recherche
  );
  const expiryDate = abonnement?.echeance ?? convention?.date_expiration ?? null;
  // Avant la première validation, la date technique créée avec le dossier n'est pas
  // le début de l'essai : l'échéance ne peut donc pas suspendre un dossier encore en attente.
  const awaitingFirstActivation = profile.actif !== true && activeLinkIds.size === 0 &&
    !(pharmacies ?? []).some((ph) => ph.actif && ph.visible_recherche);
  const isCommerciallyBlocked = Boolean(
    abonnement?.bloque_le ||
    (abonnement?.statut && !["actif", "active"].includes(abonnement.statut.toLowerCase())) ||
    (convention?.statut && !["actif", "active"].includes(convention.statut.toLowerCase())) ||
    (!awaitingFirstActivation && abonnement?.echeance && abonnement.echeance < today) ||
    (!awaitingFirstActivation && convention?.date_expiration && convention.date_expiration < today)
  );
  const contractDataUnavailable = Boolean(conventionError || abonnementError);
  const contractIncomplete = !contractDataUnavailable && Boolean(
    !convention ||
    !abonnement ||
    abonnement.convention_id !== convention.id ||
    abonnement.montant_mensuel !== convention.montant_mensuel ||
    abonnement.echeance !== convention.date_expiration ||
    convention.architecture_code !== profile.architecture_code
  );
  const hasNoOperationalNetwork = !hasOperationalNetwork;
  const shouldShowAccessStatus = isCommerciallyBlocked || contractDataUnavailable || contractIncomplete || profile.actif !== true || hasNoOperationalNetwork;
  const hasLoadError = linksError || caissesError || pharmaciesError || contractDataUnavailable;

  if (shouldShowAccessStatus) {
    const accessBlocked = isCommerciallyBlocked;
    const contractNeedsReview = !accessBlocked && contractIncomplete;
    const statusUnavailable = contractDataUnavailable || hasLoadError;
    const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Promoteur";
    return (
      <main className="min-h-dvh bg-[#F2FAF5] px-4 py-8 text-naxa-green-900">
        <div className="mx-auto max-w-3xl space-y-5">
          <header className="rounded-3xl bg-naxa-green-900 p-6 text-white sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">NAXA · Espace Promoteur</p>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{accessBlocked ? "Accès commercial suspendu" : statusUnavailable ? "Statut momentanément indisponible" : contractNeedsReview ? "Dossier à finaliser" : `Bienvenue, ${displayName}`}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">{accessBlocked ? "Le contrat ou la validité commerciale ne permet pas actuellement d’utiliser les outils du réseau." : statusUnavailable ? "NAXA n’a pas pu confirmer le statut contractuel ou le périmètre du réseau. Les outils restent fermés par précaution ; réessayez plus tard." : contractNeedsReview ? "La convention et l’abonnement doivent être cohérents avant l’ouverture des outils de gestion." : "Votre espace est préparé. NAXA termine les contrôles nécessaires avant l’ouverture des outils de gestion."}</p>
          </header>

          {hasLoadError && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Le statut détaillé ne peut pas être chargé pour le moment. Aucun accès n’a été activé par cette page.</p>}

          <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className={accessBlocked ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-xl" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl"} aria-hidden="true">{accessBlocked ? "!" : "◷"}</span>
              <div>
                <p className={accessBlocked ? "text-xs font-bold uppercase tracking-[.14em] text-red-800" : "text-xs font-bold uppercase tracking-[.14em] text-amber-800"}>{accessBlocked ? "Abonnement / validité" : statusUnavailable ? "Vérification impossible" : contractNeedsReview ? "Configuration contractuelle" : "Dossier en cours"}</p>
                <h2 className="mt-1 text-xl font-extrabold">{accessBlocked ? "Accès suspendu — régularisation requise" : statusUnavailable ? "Statut non confirmé" : contractNeedsReview ? "Convention et abonnement à vérifier" : "Activation en attente de validation"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{accessBlocked ? "Les fonctions réseau restent fermées tant que la validité commerciale n’est pas rétablie par le processus NAXA. Cette page ne réactive aucun compte et n’effectue aucun paiement." : statusUnavailable ? "La vérification du dossier n’a pas abouti. Aucun accès n’est accordé sur la base de données incomplètes." : contractNeedsReview ? "Le compte ne peut pas utiliser les fonctions réseau tant que NAXA n’a pas confirmé l’unicité de la convention, le rattachement de l’abonnement et l’égalité du tarif." : "Le compte Promoteur ne peut pas encore administrer de pharmacie, créer des Caisses ou consulter les indicateurs du réseau. Ces fonctions s’ouvriront après la validation par NAXA."}</p>
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
                  <div><p className="font-bold">Compte Promoteur créé</p><p className="text-sm text-slate-600">Votre accès est reconnu par NAXA.</p></div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-extrabold text-amber-900">2</span>
                  <div><p className="font-bold">Contrôle administratif</p><p className="text-sm text-slate-600">NAXA vérifie les autorisations, le rattachement de la pharmacie, la convention, l’abonnement et l’architecture attribuée.</p></div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-sm font-extrabold text-slate-500">3</span>
                  <div><p className="font-bold">Ouverture de l’espace</p><p className="text-sm text-slate-600">Le réseau, la gestion de l’équipe et le Pilotage 360° seront accessibles après activation.</p></div>
                </li>
              </ol>
            )}
          </section>

          <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <h2 className="font-extrabold">Pharmacie rattachée au dossier</h2>
            {(pharmacies ?? []).length ? (
              <ul className="mt-3 space-y-3">
                {(pharmacies ?? []).map((ph) => (
                  <li key={ph.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4">
                    <div><p className="font-bold">{ph.nom}</p><p className="text-sm text-slate-600">{[ph.quartier, ph.ville].filter(Boolean).join(" · ") || "Localisation non renseignée"}</p></div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{activeLinkIds.has(ph.id) && ph.actif && ph.visible_recherche ? "Actif" : "En attente"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-slate-600">Le rattachement de la pharmacie n’est pas encore visible. L’équipe NAXA doit finaliser le dossier.</p>}
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
  ] = await Promise.all([
    scopedIds.length
      ? adminDb.from("pharmacien_service_sessions").select("id,pharmacie_id,pharmacien_id,started_at,ended_at").in("pharmacie_id", scopedIds).order("started_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    scopedIds.length
      ? adminDb.from("gestionnaire_stock_sessions").select("id,pharmacie_id,user_id,started_at,ended_at").in("pharmacie_id", scopedIds).order("started_at", { ascending: false }).limit(50)
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
  ]);
  const serviceSessionsError = Boolean(ecartsCaisseError || pharmacistSessionsResult.error || stockSessionsResult.error || staffProfilesResult.error);
  const accountingError = Boolean(accountingPeriodsResult.error || accountingQueueResult.error || accountingEntriesResult.error || accountingPeriodsListResult.error);
  const networkSalesError = Boolean(networkSalesResult.error);
  const salesByPharmacy = new Map<string, { ca: number; ventes: number }>();
  for (const row of networkSalesResult.data ?? []) { const current = salesByPharmacy.get(row.pharmacie_id) ?? { ca: 0, ventes: 0 }; current.ca += Number(row.total ?? 0); current.ventes += Number(row.ventes ?? 0); salesByPharmacy.set(row.pharmacie_id, current); }
  const staffProfiles = staffProfilesResult.data ?? [];
  const staffById = new Map(staffProfiles.map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.username || "Personnel"] as const));
  const periodsByPharmacy = new Map<string, { id: string; pharmacie_id: string; date_debut: string; date_fin: string; statut: string }>();\n  for (const period of accountingPeriodsListResult.data ?? []) if (!periodsByPharmacy.has(period.pharmacie_id)) periodsByPharmacy.set(period.pharmacie_id, period);
  const pharmacistSessions = pharmacistSessionsResult.data ?? [];
  const stockSessions = stockSessionsResult.data ?? [];
  const staffSessions = [
    ...(caisseSessions ?? []).map((s) => ({ id: s.id, pharmacyId: caisseById.get(s.caisse_id)?.pharmacie_id ?? "", userId: s.ouvert_par, startedAt: s.ouvert_at, endedAt: s.cloture_at, role: "Caisse", label: caisseById.get(s.caisse_id)?.nom ?? "Caisse" })),
    ...pharmacistSessions.map((s) => ({ id: s.id, pharmacyId: s.pharmacie_id, userId: s.pharmacien_id, startedAt: s.started_at, endedAt: s.ended_at, role: "Pharmacien", label: "Service pharmacien" })),
    ...stockSessions.map((s) => ({ id: s.id, pharmacyId: s.pharmacie_id, userId: s.user_id, startedAt: s.started_at, endedAt: s.ended_at, role: "Gestionnaire de stock", label: "Service stock" })),
  ].filter((s) => activePharmacyIds.has(s.pharmacyId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50);
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
    <main className="min-h-screen bg-[#F2FAF5] px-4 pb-16 text-naxa-green-900">
      <div className="mx-auto max-w-7xl space-y-5">
        <header id="accueil" className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-naxa-green-900 p-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-white/70">NAXA · Niveau N1</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Espace Promoteur</h1>
            <p className="mt-1 text-sm text-white/80">Bonjour {displayName}. Pilotez le réseau qui vous est attribué.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-full border border-white/50 px-4 py-2 text-sm font-bold" href="/pharmacie?vue=operation">Ouvrir les opérations</Link>
            <Link className="rounded-full bg-[#FFE33D] px-4 py-2 text-sm font-bold text-naxa-green-900" href="/pharmacie/caisses">Gérer l’équipe</Link>
          </div>
        </header>
        <div className="grid gap-5 lg:grid-cols-[235px_minmax(0,1fr)]">
          <aside aria-label="Navigation Promoteur" className="h-fit rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm lg:sticky lg:top-4">
            <p className="px-3 pb-2 pt-1 text-xs font-extrabold uppercase tracking-[.14em] text-slate-500">Espace Promoteur</p>
            <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { label: "1. Tableau de bord", href: "#accueil", icon: "▦" },
                { label: "2. Mon réseau", href: "#reseau", icon: "⌘" },
                { label: "3. Pilotage & performances", href: "/pharmacie/pilotage", icon: "↗" },
                { label: "4. Marketplace & réservations", href: "/pharmacie?vue=operation", icon: "◇" },
                { label: "5. ERP & opérations", href: "/pharmacie?vue=operation", icon: "▤" },
                { label: "6. Administration & personnel", href: "/pharmacie/caisses", icon: "♙" },
                { label: "7. Convention & abonnement", href: "#convention", icon: "▧" },
                { label: "8. Rapports & exports", href: "/pharmacie/pilotage/rapports", icon: "▥" },
                { label: "9. Sécurité & accès", href: "#securite", icon: "◇" },
                { label: "10. Configuration", href: "#configuration", icon: "⚙" },
                { label: "11. Mon profil", href: "#profil", icon: "♙" },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-[#F2FAF5] hover:text-naxa-green-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naxa-green-900">
                  <span aria-hidden="true" className="w-4 text-center text-naxa-green-700">{item.icon}</span><span>{item.label}</span>
                </Link>
              ))}
              <form action={async () => {
                "use server";
                const session = supabaseServer();
                await session.auth.signOut();
                redirect("/connexion");
              }}>
                <button type="submit" className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
                  <span aria-hidden="true" className="w-4 text-center">↪</span><span>12. Déconnexion</span>
                </button>
              </form>
            </nav>
            <p className="mt-3 border-t border-slate-100 px-3 pt-3 text-xs leading-5 text-slate-500">Les données visibles restent limitées au réseau autorisé. Les modules non dédiés réutilisent les écrans existants sans contourner les droits serveur.</p>
          </aside>
          <div className="min-w-0 space-y-5">
        <AvisRappelsLotsPromoteur />

        {alert && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Certaines données ne sont pas disponibles. Les indicateurs indisponibles sont affichés sans inventer de valeurs.</p>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((k) => <article key={k.title} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">{k.title}</p>
            <p className="mt-2 text-2xl font-extrabold tabular-nums">{k.value}</p>
            <p className="mt-1 text-xs text-slate-500">{k.note}</p>
          </article>)}
        </section>

        <div aria-label="Palette Promoteur" className="flex h-2 overflow-hidden rounded-full border border-slate-200" title="Palette visuelle : vert 40 %, jaune canari 25 %, blanc 15 %, orange canari 10 %, bleu canari 5 %, rouge 5 %">
          <span style={{ width: "40%", backgroundColor: "#0A6B3A" }} />
          <span style={{ width: "25%", backgroundColor: "#FFE33D" }} />
          <span style={{ width: "15%", backgroundColor: "#FFFFFF" }} />
          <span style={{ width: "10%", backgroundColor: "#FFB000" }} />
          <span style={{ width: "5%", backgroundColor: "#3DBBFF" }} />
          <span style={{ width: "5%", backgroundColor: "#DC2626" }} />
        </div>

        <section id="sessions-personnel" className="rounded-2xl border border-[#FFB000]/50 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold">Prise / fin de service — réseau</h2><p className="mt-1 text-sm text-slate-600">Historique récent des sessions Caisse, Pharmacien et Gestionnaire de stock, limité aux pharmacies actives du Promoteur.</p></div>
            <span className="rounded-full bg-[#FFE33D] px-3 py-1 text-xs font-extrabold text-naxa-green-900">{serviceSessionsError ? "Indisponible" : `${openServiceCount} service(s) ouvert(s)`}</span>
          </div>
          {serviceSessionsError ? <p role="status" className="mt-3 rounded-xl bg-orange-50 p-3 text-sm text-orange-950">Les sessions de service ne peuvent pas toutes être chargées. Aucun chiffre incomplet n'est présenté comme un résultat complet.</p> : !staffSessions.length ? <p className="mt-3 rounded-xl bg-[#F2FAF5] p-3 text-sm text-slate-600">Aucune session de service disponible pour les postes dont le suivi est configuré.</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead><tr className="border-b border-slate-200 text-slate-500"><th className="p-2">Poste / service</th><th className="p-2">Personnel</th><th className="p-2">Prise</th><th className="p-2">Fin</th><th className="p-2">État</th></tr></thead>
                <tbody>{staffSessions.map((s) => <tr key={s.role + s.id} className="border-b border-slate-100">
                  <td className="p-2"><span className="font-bold">{s.role}</span><span className="block text-xs text-slate-500">{s.label}</span></td>
                  <td className="p-2">{staffById.get(s.userId) ?? "Personnel non identifié"}</td>
                  <td className="p-2 tabular-nums">{dateTime(s.startedAt)}</td><td className="p-2 tabular-nums">{dateTime(s.endedAt)}</td>
                  <td className="p-2"><span className={s.endedAt ? "rounded-full bg-[#F2FAF5] px-2 py-1 text-xs font-bold text-naxa-green-900" : "rounded-full bg-[#FFE33D] px-2 py-1 text-xs font-bold text-naxa-green-900"}>{s.endedAt ? "Clôturé" : "Ouvert"}</span></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-slate-500">Le suivi est affiché uniquement pour les postes disposant d'une table de session. Les rôles sans journal de service ne sont pas inventés.</p>
        </section>

        <section id="clotures-caisses" className="rounded-2xl border border-[#FFE33D] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold">Clôtures de caisse et soldes de fin de service</h2><p className="mt-1 text-sm text-slate-600">Inclut les clôtures sans écart : le solde théorique et le montant compté sont visibles même lorsque l'écart est nul.</p></div>
            <span className="rounded-full bg-[#FFE33D] px-3 py-1 text-xs font-extrabold text-naxa-green-900">{ecartsCaisseError ? "Indisponible" : `${(caisseSessions ?? []).filter((s) => Boolean(s.cloture_at)).length} clôture(s) récentes`}</span>
          </div>
          {ecartsCaisseError ? <p role="status" className="mt-3 rounded-xl bg-orange-50 p-3 text-sm text-orange-950">L'historique des sessions de caisse est indisponible.</p> : !(caisseSessions ?? []).some((s) => s.cloture_at) ? <p className="mt-3 rounded-xl bg-[#F2FAF5] p-3 text-sm text-slate-600">Aucune clôture récente dans le périmètre autorisé.</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead><tr className="border-b border-slate-200 text-slate-500"><th className="p-2">Caisse</th><th className="p-2">Clôture</th><th className="p-2">Théorique</th><th className="p-2">Compté</th><th className="p-2">Écart</th></tr></thead>
                <tbody>{(caisseSessions ?? []).filter((s) => s.cloture_at).slice(0, 30).map((s) => <tr key={s.id} className="border-b border-slate-100">
                  <td className="p-2 font-bold">{caisseById.get(s.caisse_id)?.nom ?? "Caisse"}</td><td className="p-2">{dateTime(s.cloture_at)}</td><td className="p-2 tabular-nums">{fcfa(s.total_theorique)}</td><td className="p-2 tabular-nums">{s.total_compte === null ? "Non renseigné" : fcfa(s.total_compte)}</td>
                  <td className="p-2"><span className={Number(s.ecart ?? 0) === 0 ? "rounded-full bg-[#F2FAF5] px-2 py-1 text-xs font-bold text-naxa-green-900" : Number(s.ecart) < 0 ? "rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-900" : "rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-900"}>{Number(s.ecart ?? 0) > 0 ? "+" : ""}{fcfa(Number(s.ecart ?? 0))}</span></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        <section id="comptabilite-reseau" className="space-y-3">
          <div><h2 className="text-lg font-extrabold">Contrôle comptable — réseau</h2><p className="mt-1 text-sm text-slate-600">Indicateurs de traitement et de clôture, en lecture seule. Ils ne remplacent pas les états comptables validés.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: "Périodes comptables ouvertes", value: accountingError ? "Indisponible" : String(accountingPeriodsResult.count ?? 0), color: "border-[#3DBBFF] bg-sky-50" },
              { title: "Événements à traiter / en erreur", value: accountingError ? "Indisponible" : String(accountingQueueResult.count ?? 0), color: "border-[#FFB000] bg-orange-50" },
              { title: "Écritures des 30 derniers jours", value: accountingError ? "Indisponible" : String(accountingEntriesResult.count ?? 0), color: "border-emerald-700 bg-[#F2FAF5]" },
            ].map((item) => <article key={item.title} className={`rounded-2xl border p-4 shadow-sm ${item.color}`}><p className="text-sm font-semibold text-slate-600">{item.title}</p><p className="mt-2 text-2xl font-black tabular-nums">{item.value}</p></article>)}
          </div>
          {accountingError && <p role="status" className="rounded-xl bg-orange-50 p-3 text-sm text-orange-950">Une source comptable est indisponible ; les indicateurs comptables sont marqués « Indisponible ».</p>}
        </section>

        <section id="comparaison-pharmacies" className="rounded-2xl border border-[#3DBBFF]/60 bg-white p-5 shadow-sm">
          <div><h2 className="text-lg font-extrabold">Comparaison par pharmacie et période</h2><p className="mt-1 text-sm text-slate-600">Lecture comparative du statut de clôture comptable par pharmacie. Les périodes affichées proviennent du socle comptable ; aucune marge historique n'est calculée.</p></div>
          {!activePharmacies.length ? <p className="mt-3 rounded-xl bg-[#F2FAF5] p-3 text-sm text-slate-600">Aucune pharmacie opérationnelle dans le périmètre.</p> : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {activePharmacies.map((ph) => {
                const period = periodsByPharmacy.get(ph.id);
                const caisseCount = operationalCaisses.filter((x) => x.pharmacie_id === ph.id && x.actif).length;
                const sessionCount = staffSessions.filter((s) => s.pharmacyId === ph.id && !s.endedAt).length;
                return <article key={ph.id} className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-extrabold">{ph.nom}</h3>
                  <p className="mt-2 text-sm text-slate-600">CA qualifié · 30 jours : <strong>{networkSalesError ? "Indisponible" : fcfa(salesByPharmacy.get(ph.id)?.ca ?? 0)}</strong></p>
                  <p className="mt-1 text-sm text-slate-600">Ventes qualifiées · 30 jours : <strong>{networkSalesError ? "Indisponible" : String(salesByPharmacy.get(ph.id)?.ventes ?? 0)}</strong></p>
                  <p className="mt-1 text-sm text-slate-600">Caisses actives : <strong>{caissesError ? "Indisponible" : caisseCount}</strong></p>
                  <p className="mt-1 text-sm text-slate-600">Services ouverts : <strong>{serviceSessionsError ? "Indisponible" : sessionCount}</strong></p>
                  <p className="mt-1 text-sm text-slate-600">Période comptable la plus récente : <strong>{accountingError ? "Indisponible" : period ? `${date(period.date_debut)} – ${date(period.date_fin)} · ${period.statut}` : "Aucune période configurée"}</strong></p></article>;
              })}
            </div>
          )}
        </section>

        <section id="controle-postes" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-extrabold">Contrôle opérationnel par poste</h2><p className="mt-1 text-sm text-slate-600">Indicateurs agrégés des comptes rattachés aux pharmacies actives. Les dossiers de santé nominatifs ne sont jamais affichés ici.</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">Périmètre : {activePharmacies.length} pharmacie(s)</span>
          </div>
          {roleControlError && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Une ou plusieurs sources de poste sont indisponibles. Les valeurs concernées sont affichées « Indisponible », pas comme des zéros.</p>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { title: "Responsables", people: roleControl.responsables, metric: "Comptes actifs", detail: "Supervision des Caisses et opérations du périmètre délégué", href: "/pharmacie/pilotage" },
              { title: "Caisses", people: roleControl.caisses, metric: "Comptes actifs", detail: `Ventes, sessions et écarts à vérifier parmi les dernières clôtures chargées : ${ecartsCaisseError ? "indisponible" : (ecartsCaisse ?? []).filter((e) => e.ecart_statut === "a_verifier").length}`, href: "/pharmacie/caisses" },
              { title: "Pharmaciens", people: roleControl.pharmaciens, metric: "Comptes actifs", detail: roleControl.prescriptions === null ? "Ordonnances en attente : indisponible" : `Ordonnances à contrôler : ${roleControl.prescriptions}`, href: "/pharmacie/pharmacien" },
              { title: "Gestionnaires de stock / magasiniers", people: roleControl.stock, metric: "Comptes actifs", detail: roleControl.stocksBas === null ? "Stocks bas : indisponible" : `Références à stock bas : ${roleControl.stocksBas}`, href: "/pharmacie/gestionnaire-stock" },
              { title: "Réservations Marketplace", people: null, metric: "À traiter", detail: roleControl.reservations === null ? "Source réservations indisponible" : `${roleControl.reservations} réservation(s) en attente ou confirmée(s)`, href: "/pharmacie?vue=operation" },
              { title: "Lots & préparations", people: null, metric: "Points de contrôle", detail: roleControl.lotsAControler === null || roleControl.preparations === null ? "Source lots ou préparations indisponible" : `${roleControl.lotsAControler} lot(s) à contrôler · ${roleControl.preparations} préparation(s) en cours`, href: "/pharmacie/gestionnaire-stock/lots-peremptions" },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><h3 className="font-extrabold">{item.title}</h3><span className="rounded-full bg-[#F2FAF5] px-2 py-1 text-xs font-semibold text-naxa-green-900">{item.metric}</span></div>
                <p className="mt-3 text-2xl font-black tabular-nums">{item.people === null ? "—" : item.people === undefined ? "Indisponible" : String(item.people)}</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">{item.detail}</p>
                <Link className="mt-3 inline-flex min-h-10 items-center rounded-full border border-emerald-200 px-3 py-2 text-sm font-bold text-naxa-green-900 hover:bg-[#F2FAF5]" href={item.href}>Ouvrir le module →</Link>
              </article>
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-500">Les chiffres de stock bas utilisent le seuil opérationnel déjà utilisé par le poste Gestionnaire de stock (quantité ≤ 5). Ce seuil décrit une alerte de travail, pas une règle réglementaire. Les métriques de marge et de rentabilité ne sont pas affichées tant que le coût historique au moment de la vente n’est pas disponible.</p>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">Écarts de caisse à vérifier</h2>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{(ecartsCaisse ?? []).filter((x) => x.ecart_statut === "a_verifier").length} à vérifier</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">Les écarts clôturés sont conservés avec leur justification. Cet écran est en lecture seule : une correction comptable doit être une opération séparée et auditée.</p>
          {!ecartsCaisse?.length ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Aucun écart de clôture enregistré sur le réseau actif.</p> : <ul className="mt-3 space-y-2">
            {ecartsCaisse.map((e) => {
              const caisse = caisseById.get(e.caisse_id);
              return <li key={e.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-bold">{caisse?.nom ?? "Caisse"} · {date(e.cloture_at)}</p><p className="text-sm text-slate-600">Théorique : {fcfa(e.total_theorique)} · Compté : {e.total_compte === null ? "Non renseigné" : fcfa(e.total_compte)}</p>
                    {e.ecart_justification && <p className="mt-1 text-sm">Justification : {e.ecart_justification}</p>}
                  </div><div className="text-right"><p className={Number(e.ecart) < 0 ? "font-extrabold text-red-700" : "font-extrabold text-amber-800"}>{Number(e.ecart) > 0 ? "+" : ""}{fcfa(Number(e.ecart))}</p><p className="text-xs text-slate-500">{e.ecart_statut === "a_verifier" ? "À vérifier" : e.ecart_statut}</p></div>
                </div>
              </li>;
            })}
          </ul>}
        </section>

        <section id="reseau" className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
          <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-lg font-extrabold">Mon réseau</h2><p className="text-sm text-slate-600">Les pharmacies sont attribuées par NAXA. Chaque pharmacie garde son propre stock et sa propre identité.</p></div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold">{activePharmacies.length} active(s)</span>
            </div>
            {!activePharmacies.length ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune pharmacie opérationnelle n’est disponible sur votre périmètre. NAXA doit finaliser le rattachement et l’activation avant toute administration.</div> : (
              <div className="mt-4 space-y-3">
                {activePharmacies.map((ph) => {
                  const caisseCount = (caisses ?? []).filter((c) => c.pharmacie_id === ph.id).length;
                  const activeCount = (caisses ?? []).filter((c) => c.pharmacie_id === ph.id && c.actif).length;
                  return <article key={ph.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h3 className="font-extrabold">{ph.nom}</h3><p className="text-sm text-slate-600">{[ph.quartier, ph.ville].filter(Boolean).join(" · ") || "Localisation non renseignée"}</p></div>
                      <span className={ph.actif ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900" : "rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-900"}>{ph.actif ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
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
            <article id="convention" className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-extrabold">Convention et abonnement</h2>
              {contractStatus ? <>
                <p className="mt-3 text-sm text-slate-600">État commercial</p>
                <p className={contractStatus === "actif" || contractStatus === "active" ? "font-extrabold text-emerald-800" : "font-extrabold text-red-700"}>{contractStatus.toUpperCase()}</p>
                <p className="mt-2 text-sm text-slate-600">Tarif mensuel</p><p className="font-bold">{contractAmount ? fcfa(contractAmount) : "Non configuré"}</p>
                <p className="mt-2 text-sm text-slate-600">Échéance</p><p className="font-bold">{date(expiry)}</p>
                {abonnement?.bloque_le && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">Blocage commercial enregistré le {date(abonnement.bloque_le)}. Contactez NAXA pour régulariser.</p>}
                {abonnement?.rappel_5j_envoye_at && <p className="mt-2 text-xs text-amber-800">Un rappel d’échéance a été enregistré le {date(abonnement.rappel_5j_envoye_at)}.</p>}
              </> : <p className="mt-3 text-sm text-slate-600">Aucune convention ou aucun abonnement n’est configuré pour ce Promoteur. Contactez l’équipe NAXA pour finaliser l’attribution.</p>}
              <p className="mt-3 text-xs text-slate-500">La modification du tarif et la réactivation commerciale sont réservées à NAXA. Cet écran est en lecture seule.</p>
            </article>

            <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
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

        <div id="securite" className="space-y-4">
          <CaisseSecurityManager cashiers={(caisses ?? []).filter((c) => c.actif === true && c.pharmacie_id && activePharmacyIds.has(c.pharmacie_id)).map((c) => ({ id: c.id, username: c.username ?? null, first_name: c.first_name ?? null, last_name: c.last_name ?? null, pharmacie_id: c.pharmacie_id ?? null, actif: true }))} />
          <section id="configuration" className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">Configuration et périmètre contractuel</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Architecture attribuée par NAXA : <strong>{convention?.architecture_code ?? profile.architecture_code ?? "Non renseignée"}</strong>. Le Promoteur peut gérer les Caisses et déléguer uniquement les privilèges compatibles, actifs et délégables. Les paramètres de convention et les droits de gouvernance ne sont pas modifiables depuis cet espace.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="btn btn-clair" href="/pharmacie/caisses/privileges">Consulter les droits déléguables</Link>
              <Link className="btn btn-clair" href="/pharmacie/aide">Centre d’aide</Link>
            </div>
          </section>
          <section id="profil" className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">Mon profil Promoteur</h2>
            <p className="mt-2 text-sm text-slate-600">Identité de session : {displayName}. Rôle : Promoteur (niveau N1). Les informations ci-dessous proviennent du profil connecté.</p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[#F2FAF5] p-3"><dt className="text-xs font-semibold text-slate-500">Nom affiché</dt><dd className="mt-1 font-bold">{displayName}</dd></div>
              <div className="rounded-xl bg-[#F2FAF5] p-3"><dt className="text-xs font-semibold text-slate-500">État du compte</dt><dd className="mt-1 font-bold">{profile.actif ? "Actif" : "En attente de validation"}</dd></div>
            </dl>
          </section>
        </div>

        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">Limites de gouvernance</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Le Promoteur ne peut pas créer une nouvelle pharmacie, modifier sa convention, changer le tarif, réactiver commercialement un réseau bloqué ni s’attribuer des privilèges. Ces actions restent sous contrôle de NAXA. Les pharmacies hors réseau ne sont jamais affichées comme administrables.</p>
        </section>
          </div>
        </div>
      </div>
    </main>
  );
}
