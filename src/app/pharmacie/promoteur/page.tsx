import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { fcfa } from "@/lib/ranking";

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
    .select("id,role,actif,first_name,last_name,pharmacie_id")
    .eq("id", auth.user.id).single();
  if (profile?.role !== "promoteur") redirect("/");

  const [
    { data: links, error: linksError },
    { data: caisses, error: caissesError },
  ] = await Promise.all([
    sb.from("promoteur_pharmacies")
      .select("pharmacie_id,actif,created_at")
      .eq("promoteur_id", auth.user.id),
    sb.from("profiles")
      .select("id,pharmacie_id,actif")
      .eq("parent_profile_id", auth.user.id)
      .eq("role", "caisse"),
  ]);

  const ids = [...new Set((links ?? []).map((x) => x.pharmacie_id))];
  const { data: pharmacies, error: pharmaciesError } = ids.length
    ? await sb.from("pharmacies").select("id,nom,ville,quartier,actif,visible_recherche,de_garde,stock_updated_at").in("id", ids).order("nom")
    : { data: [] as { id: string; nom: string; ville: string | null; quartier: string | null; actif: boolean; visible_recherche: boolean; de_garde: boolean; stock_updated_at: string | null }[], error: null };

  const { data: statsData, error: statsError } = profile.actif === true
    ? await sb.rpc("stats_pilotage_scope", { p_jours: 30 })
    : { data: null, error: null };
  
  // Les tables contractuelles sont administrées par NAXA. La clé service-role
  // est utilisée uniquement après authentification et avec un filtre strict sur
  // l'identifiant du Promoteur courant.
  const adminDb = supabaseAdmin();
  const [{ data: convention }, { data: abonnement }] = await Promise.all([
    adminDb.from("conventions_promoteurs")
      .select("montant_mensuel,date_paiement,date_expiration,statut")
      .eq("promoteur_id", auth.user.id).maybeSingle(),
    adminDb.from("abonnements_promoteurs")
      .select("montant_mensuel,debut,echeance,statut,bloque_le,reactive_le,rappel_5j_envoye_at")
      .eq("promoteur_id", auth.user.id).maybeSingle(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const linkActive = (links ?? []).some((link) => link.actif);
  const visiblePharmacy = (pharmacies ?? []).some((ph) => ph.actif && ph.visible_recherche);
  const commercialStatus = (abonnement?.statut ?? convention?.statut ?? null)?.toLowerCase() ?? null;
  const expiryDate = abonnement?.echeance ?? convention?.date_expiration ?? null;
  const isCommerciallyBlocked = Boolean(
    abonnement?.bloque_le ||
    (commercialStatus && !["actif", "active"].includes(commercialStatus)) ||
    (expiryDate && expiryDate < today)
  );
  const isPendingActivation = profile.actif !== true && !isCommerciallyBlocked;
  const hasNoOperationalNetwork = !linkActive && !visiblePharmacy;
  const shouldShowAccessStatus = isCommerciallyBlocked || isPendingActivation || hasNoOperationalNetwork;
  const hasLoadError = linksError || caissesError || pharmaciesError;

  if (shouldShowAccessStatus) {
    const accessBlocked = isCommerciallyBlocked;
    const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Promoteur";
    const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Promoteur";
    return (
      <main className="min-h-dvh bg-[#F2FAF5] px-4 py-8 text-naxa-green-900">
        <div className="mx-auto max-w-3xl space-y-5">
          <header className="rounded-3xl bg-naxa-green-900 p-6 text-white sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">NAXA · Espace Promoteur</p>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{accessBlocked ? "Accès commercial suspendu" : `Bienvenue, ${displayName}`}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">{accessBlocked ? "Le contrat ou la validité commerciale ne permet pas actuellement d’utiliser les outils du réseau." : "Votre espace est préparé. NAXA termine les contrôles nécessaires avant l’ouverture des outils de gestion."}</p>
          </header>

          {hasLoadError && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Le statut détaillé ne peut pas être chargé pour le moment. Aucun accès n’a été activé par cette page.</p>}

          <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className={accessBlocked ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-xl" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl"} aria-hidden="true">{accessBlocked ? "!" : "◷"}</span>
              <div>
                <p className={accessBlocked ? "text-xs font-bold uppercase tracking-[.14em] text-red-800" : "text-xs font-bold uppercase tracking-[.14em] text-amber-800"}>{accessBlocked ? "Abonnement / validité" : "Dossier en cours"}</p>
                <h2 className="mt-1 text-xl font-extrabold">{accessBlocked ? "Accès suspendu — régularisation requise" : "Activation en attente de validation"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{accessBlocked ? "Les fonctions réseau restent fermées tant que la validité commerciale n’est pas rétablie par le processus NAXA. Cette page ne réactive aucun compte et n’effectue aucun paiement." : "Le compte Promoteur ne peut pas encore administrer de pharmacie, créer des Caisses ou consulter les indicateurs du réseau. Ces fonctions s’ouvriront après la validation par NAXA."}</p>
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
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{ph.actif && ph.visible_recherche && linkActive ? "Accès en cours de synchronisation" : "En attente"}</span>
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

  const stats = (statsData ?? null) as Stats | null;
  const caissesActives = (caisses ?? []).filter((x) => x.actif).length;
  const caissesBloquees = (caisses ?? []).filter((x) => !x.actif).length;
  const alert = linksError || caissesError || pharmaciesError || statsError;
  const contractAmount = abonnement?.montant_mensuel ?? convention?.montant_mensuel ?? null;
  const contractStatus = abonnement?.statut ?? convention?.statut ?? null;
  const expiry = abonnement?.echeance ?? convention?.date_expiration ?? null;
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Promoteur";

  const kpis = [
    { title: "Pharmacies dans le réseau", value: String(pharmacies?.length ?? 0), note: "Liens actifs attribués par NAXA" },
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

        <section className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
          <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-lg font-extrabold">Mon réseau</h2><p className="text-sm text-slate-600">Les pharmacies sont attribuées par NAXA. Chaque pharmacie garde son propre stock et sa propre identité.</p></div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold">{pharmacies?.length ?? 0} active(s)</span>
            </div>
            {!pharmacies?.length ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune pharmacie active n’est rattachée à votre compte. NAXA doit créer le lien de réseau avant que vous puissiez administrer une pharmacie.</div> : (
              <div className="mt-4 space-y-3">
                {pharmacies.map((ph) => {
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
                    {ph.id === profile.pharmacie_id && <Link className="mt-3 inline-flex min-h-11 items-center rounded-full bg-naxa-green-900 px-4 py-2 text-sm font-bold text-white" href="/pharmacie">Ouvrir l’espace opérationnel</Link>}
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

        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">Ce que le tableau ne modifie pas</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Le Promoteur ne peut pas créer une nouvelle pharmacie, modifier sa convention, changer le tarif, réactiver commercialement un réseau bloqué ni s’attribuer des privilèges. Ces actions restent sous contrôle de NAXA. Les pharmacies hors réseau ne sont jamais affichées comme administrables.</p>
        </section>
      </div>
    </main>
  );
}
