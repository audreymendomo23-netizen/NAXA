import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { fcfa } from "@/lib/ranking";
import { CaisseSecurityManager } from "@/components/pharmacie/CaisseSecurityManager";

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

export default async function EspacePromoteur() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/promoteur");

  const { data: profile } = await sb.from("profiles")
    .select("id,role,actif,first_name,last_name,pharmacie_id,architecture_code")
    .eq("id", auth.user.id).single();
  if (profile?.role !== "promoteur") redirect("/");
  const adminDb = supabaseAdmin();

  const [
    { data: links, error: linksError },
    { data: caisses, error: caissesError },
  ] = await Promise.all([
    adminDb.from("promoteur_pharmacies")
      .select("pharmacie_id,actif,created_at")
      .eq("promoteur_id", auth.user.id),
    sb.from("profiles")
      .select("id,username,first_name,last_name,pharmacie_id,actif")
      .eq("parent_profile_id", auth.user.id)
      .eq("role", "caisse"),
  ]);

  const ids = [...new Set((links ?? []).map((x) => x.pharmacie_id))];
  const { data: pharmacies, error: pharmaciesError } = ids.length
    ? await adminDb.from("pharmacies").select("id,nom,ville,quartier,actif,visible_recherche,de_garde,stock_updated_at").in("id", ids).order("nom")
    : { data: [] as { id: string; nom: string; ville: string | null; quartier: string | null; actif: boolean; visible_recherche: boolean; de_garde: boolean; stock_updated_at: string | null }[], error: null };

  const operationalIds = [...new Set((links ?? []).filter((link) => link.actif).map((link) => link.pharmacie_id))];
  const { data: caisseRows } = operationalIds.length
    ? await adminDb.from("caisses").select("id,nom,pharmacie_id").in("pharmacie_id", operationalIds)
    : { data: [] as { id: string; nom: string; pharmacie_id: string }[] };
  const caisseIds = (caisseRows ?? []).map((c) => c.id);
  const { data: ecartsCaisse } = caisseIds.length
    ? await adminDb.from("caisses_sessions")
        .select("id,caisse_id,cloture_at,total_theorique,total_compte,ecart,ecart_justification,ecart_statut")
        .in("caisse_id", caisseIds).neq("ecart", 0).order("cloture_at", { ascending: false }).limit(20)
    : { data: [] as { id: string; caisse_id: string; cloture_at: string | null; total_theorique: number; total_compte: number | null; ecart: number | null; ecart_justification: string | null; ecart_statut: string }[] };
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
  const operationalCaisses = (caisses ?? []).filter((c) => c.pharmacie_id && activePharmacyIds.has(c.pharmacie_id));
  const stats = (statsData ?? null) as Stats | null;
  const caissesActives = operationalCaisses.filter((x) => x.actif).length;
  const caissesBloquees = operationalCaisses.filter((x) => !x.actif).length;
  const alert = linksError || caissesError || pharmaciesError || statsError;
  const contractAmount = abonnement?.montant_mensuel ?? convention?.montant_mensuel ?? null;
  const contractStatus = abonnement?.statut ?? convention?.statut ?? null;
  const expiry = abonnement?.echeance ?? convention?.date_expiration ?? null;
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Promoteur";

  const kpis = [
    { title: "Pharmacies opérationnelles", value: String(activePharmacies.length), note: "Rattachement, activation et visibilité confirmés" },
    { title: "Caisses actives", value: String(caissesActives), note: caissesBloquees + " bloquée(s)" },
    { title: "Chiffre d’affaires · 30 jours", value: fcfa(stats?.ca ?? 0), note: "Ventes selon la vue canonique disponible" },
    { title: "Ruptures de stock", value: String(stats?.stock?.ruptures ?? 0), note: "Sur le périmètre autorisé" },
    { title: "Alertes", value: String(stats?.alertes ?? 0), note: "Alertes remontées par le pilotage" },
  ];

  return (
    <main className="min-h-screen bg-[#F2FAF5] px-4 pb-16 text-naxa-green-900">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-naxa-green-900 p-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-white/70">NAXA · Niveau N1</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Espace Promoteur</h1>
            <p className="mt-1 text-sm text-white/80">Bonjour {displayName}. Pilotez le réseau qui vous est attribué.</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link className="rounded-full border border-white/50 px-4 py-2 text-sm font-bold" href="/pharmacie?vue=operation">Pharmacie par défaut</Link>
            <Link className="rounded-full bg-[#FFE33D] px-4 py-2 text-sm font-bold text-naxa-green-900" href="/pharmacie/caisses">Gérer l’équipe</Link>
            <Link className="rounded-full border border-white/50 px-4 py-2 text-sm font-bold" href="/pharmacie/pilotage">Pilotage 360°</Link>
            <Link className="rounded-full border border-white/50 px-4 py-2 text-sm font-bold" href="/pharmacie/pilotage/rapports">Rapports</Link>
            <Link className="rounded-full border border-white/50 px-4 py-2 text-sm font-bold" href="/pharmacie/rappels-lots">Rappels de lots</Link>
          </nav>
        </header>

        {alert && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Certaines données ne sont pas disponibles. Les indicateurs indisponibles sont affichés sans inventer de valeurs.</p>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((k) => <article key={k.title} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">{k.title}</p>
            <p className="mt-2 text-2xl font-extrabold tabular-nums">{k.value}</p>
            <p className="mt-1 text-xs text-slate-500">{k.note}</p>
          </article>)}
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

        <section className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
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
            <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
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

        <CaisseSecurityManager cashiers={(caisses ?? []).filter((c) => c.actif === true).map((c) => ({ id: c.id, username: c.username ?? null, first_name: c.first_name ?? null, last_name: c.last_name ?? null, pharmacie_id: c.pharmacie_id ?? null, actif: true }))} />

        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">Ce que le tableau ne modifie pas</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Le Promoteur ne peut pas créer une nouvelle pharmacie, modifier sa convention, changer le tarif, réactiver commercialement un réseau bloqué ni s’attribuer des privilèges. Ces actions restent sous contrôle de NAXA. Les pharmacies hors réseau ne sont jamais affichées comme administrables.</p>
        </section>
      </div>
    </main>
  );
}
