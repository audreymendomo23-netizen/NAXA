import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  dotations: "Dotations et amortissements",
  paie: "Paie",
  tva: "TVA enregistrée",
  stock: "Stock et valorisation",
  rapprochements: "Rapprochements",
  regularisations: "Régularisations annuelles",
  a_nouveaux: "À-nouveaux",
};
const statusLabels: Record<string, string> = {
  a_controler: "À contrôler",
  valide: "Contrôlé avec preuve",
  non_applicable: "Non applicable (motif obligatoire)",
};

export default async function CloturesComptablesPage({
  searchParams,
}: {
  searchParams?: Promise<{ result?: string }>;
}) {
  const filters = await searchParams;
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/clotures");
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("id,actif,pharmacie_id").eq("id", auth.user.id).single();
  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", { p_pharmacie: profile.pharmacie_id });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const [periodResult, controlResult] = await Promise.all([
    sb.from("compta_periodes")
      .select("id,date_debut,date_fin,statut,cloturee_par,cloturee_le")
      .eq("pharmacie_id", profile.pharmacie_id)
      .order("date_debut", { ascending: false }).limit(100),
    sb.from("compta_controles_cloture")
      .select("periode_id,controle_code,statut,reference_preuve,motif,controle_le,controle_par")
      .eq("pharmacie_id", profile.pharmacie_id).limit(1000),
  ]);
  const periods = periodResult.data ?? [];
  const controls = controlResult.data ?? [];
  const controlMap = new Map(controls.map(item => [item.periode_id + ":" + item.controle_code, item]));
  const noticeLabels: Record<string, string> = {
    authentification_requise: "Reconnectez-vous pour continuer.",
    acces_refuse: "Accès refusé.",
    formulaire_invalide: "Le formulaire reçu est invalide.",
    periode_invalide: "La période sélectionnée est invalide.",
    dates_periode_invalides: "Les dates de la période sont invalides.",
    chevauchement_periode: "Ouverture refusée : cette période chevauche une période déjà enregistrée.",
    ouverture_refusee: "La période n’a pas pu être ouverte. Vérifiez les dates, les droits et le journal d’audit.",
    periode_ouverte: "Période ouverte et action journalisée.",
    controle_invalide: "Le contrôle demandé est invalide.",
    enregistrement_refuse: "Le contrôle n’a pas été enregistré. Vérifiez la période, votre périmètre et les champs requis.",
    controle_enregistre: "Contrôle enregistré et journalisé.",
    cloture_refusee: "Clôture refusée : un contrôle, un événement, une écriture ou la chaîne d’audit doit être corrigé.",
    periode_cloturee: "Période clôturée et action journalisée.",
    action_inconnue: "Action non reconnue.",
  };
  const notice = filters?.result ? noticeLabels[filters.result] ?? "Résultat de l’action indisponible." : null;

  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-16">
    <header className="rounded-2xl bg-naxa-green-900 p-5 text-white">
      <p className="text-xs uppercase tracking-wide text-emerald-100">NAXA · Comptable</p>
      <h1 className="mt-1 text-2xl font-extrabold">Clôtures comptables</h1>
      <p className="mt-1 text-sm text-emerald-100">Contrôles documentés, période par période. La clôture échoue si une condition obligatoire n’est pas satisfaite.</p>
      <Link href="/pharmacie/comptable" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/70 px-4">Retour au tableau de bord</Link>
    </header>
    {notice ? <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">{notice}</p> : null}
    {periodResult.error || controlResult.error ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Les périodes ou les contrôles ne sont pas accessibles dans cet environnement.</p> : null}
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold">Ouvrir une période comptable</h2>
      <p className="mt-1 text-sm text-slate-600">Les dates sont validées côté serveur. Les périodes qui chevauchent une période existante sont refusées et chaque ouverture est journalisée.</p>
      <form method="post" action="/api/pharmacie/comptable/clotures" className="mt-3 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="action" value="ouvrir" />
        <label className="text-sm">Début<input required type="date" name="date_debut" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
        <label className="text-sm">Fin<input required type="date" name="date_fin" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
        <div className="flex items-end"><button className="min-h-11 rounded-xl bg-naxa-green-900 px-4 font-semibold text-white">Ouvrir la période</button></div>
      </form>
    </section>
    {!periods.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Aucune période comptable</h2><p className="mt-2 text-sm text-slate-600">Aucune période n’est encore enregistrée pour cette pharmacie.</p></section> : null}
    {periods.map(period => {
      const annual = new Date(period.date_fin + "T00:00:00Z").getUTCMonth() === 11
        && new Date(period.date_fin + "T00:00:00Z").getUTCDate() === 31;
      const codes = ["dotations", "paie", "tva", "stock", "rapprochements", ...(annual ? ["regularisations", "a_nouveaux"] : [])];
      return <section key={period.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold">{period.date_debut} — {period.date_fin}</h2><p className="mt-1 text-sm text-slate-600">Statut : {period.statut === "cloturee" ? "Clôturée" : "Ouverte"}{period.cloturee_le ? " · clôturée le " + new Date(period.cloturee_le).toLocaleString("fr-CM") : ""}</p></div>
          {period.statut === "ouverte" ? <form method="post" action="/api/pharmacie/comptable/clotures"><input type="hidden" name="action" value="cloturer" /><input type="hidden" name="periode" value={period.id} /><button className="min-h-11 rounded-xl bg-naxa-green-900 px-4 font-semibold text-white">Clôturer la période</button></form> : <span className="rounded-xl border px-3 py-2 text-sm">Écritures verrouillées par période</span>}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {codes.map(code => {
            const item = controlMap.get(period.id + ":" + code);
            return <form key={code} method="post" action="/api/pharmacie/comptable/clotures" className="space-y-2 rounded-xl border border-slate-200 p-3">
              <input type="hidden" name="action" value="controle" /><input type="hidden" name="periode" value={period.id} /><input type="hidden" name="controle_code" value={code} />
              <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{labels[code]}</h3><span className="text-xs text-slate-500">{item ? statusLabels[item.statut] ?? item.statut : "À contrôler"}</span></div>
              <label className="block text-sm">État du contrôle<select name="statut" defaultValue={item?.statut ?? "a_controler"} disabled={period.statut !== "ouverte"} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="block text-sm">Référence de preuve (obligatoire si contrôlé)<input name="reference_preuve" defaultValue={item?.reference_preuve ?? ""} maxLength={500} disabled={period.statut !== "ouverte"} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" placeholder="Référence de pièce ou de vérification" /></label>
              <label className="block text-sm">Motif (obligatoire si non applicable)<input name="motif" defaultValue={item?.motif ?? ""} maxLength={500} disabled={period.statut !== "ouverte"} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" placeholder="Motif explicite si non applicable" /></label>
              {item?.controle_le ? <p className="text-xs text-slate-500">Contrôlé le {new Date(item.controle_le).toLocaleString("fr-CM")}</p> : null}
              {period.statut === "ouverte" ? <button className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold">Enregistrer le contrôle</button> : null}
            </form>;
          })}
        </div>
        {annual ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Clôture annuelle : régularisations et à-nouveaux exigés. Aucun calcul automatique de fiscalité ou de paie n’est inventé.</p> : null}
      </section>;
    })}
    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">La mention « contrôlé » enregistre une attestation et une référence fournie par l’utilisateur autorisé ; elle ne remplace pas la validation d’un expert-comptable. Les sources absentes doivent être déclarées non applicables avec motif, et ne sont pas présentées comme vérifiées.</p>
  </main>;
}
