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
  if (profile?.role !== "promoteur" || profile.actif !== true) redirect("/");

  const [
    { data: links, error: linksError },
    { data: caisses, error: caissesError },
    { data: statsData, error: statsError },
  ] = await Promise.all([
    sb.from("promoteur_pharmacies")
      .select("pharmacie_id,actif,created_at")
      .eq("promoteur_id", auth.user.id)
      .eq("actif", true),
    sb.from("profiles")
      .select("id,pharmacie_id,actif")
      .eq("parent_profile_id", auth.user.id)
      .eq("role", "caisse"),
    sb.rpc("stats_pilotage_scope", { p_jours: 30 }),
  ]);

  const ids = [...new Set((links ?? []).map((x) => x.pharmacie_id))];
  const { data: pharmacies, error: pharmaciesError } = ids.length
    ? await sb.from("pharmacies").select("id,nom,ville,quartier,actif,de_garde,stock_updated_at").in("id", ids).order("nom")
    : { data: [] as { id: string; nom: string; ville: string | null; quartier: string | null; actif: boolean; de_garde: boolean; stock_updated_at: string | null }[], error: null };
  
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
