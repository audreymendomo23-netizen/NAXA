import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import { soumettrePaiementPromoteur } from "./actions";

const LABEL: Record<string, string> = {
  especes: "Espèces", orange_money: "Orange Money", mtn_momo: "MTN Mobile Money",
  virement: "Virement bancaire", depot_bancaire: "Dépôt bancaire", autre: "Autre",
};
const money = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const dt = (s: string | null) => s ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Douala" }).format(new Date(s)) : "—";

export default async function PromoteurPaiementsPage({ searchParams }: { searchParams?: { ok?: string; erreur?: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return <main className="mx-auto max-w-2xl p-4"><section className="rounded-2xl bg-white p-5">Connectez-vous pour consulter et soumettre vos règlements.</section></main>;
  const { data: profile } = await sb.from("profiles").select("role,first_name,last_name,username").eq("id", user.id).maybeSingle();
  if (profile?.role !== "promoteur") return <main className="mx-auto max-w-2xl p-4"><section className="rounded-2xl bg-white p-5">Cette page est réservée à l’espace Promoteur.</section></main>;

  const db = supabaseAdmin();
  const [{ data: rows, error }, { data: subscription, error: subscriptionError }] = await Promise.all([
    db.from("abonnement_promoteur_reglements").select("id,montant,canal,canal_autre,compte_payeur,reference,paye_le,statut,numero_recu,identifiant_paiement,periode_du,periode_au,created_at,confirme_le,preuve_path,motif_contestation").eq("promoteur_id", user.id).order("created_at", { ascending: false }).limit(100),
    db.from("abonnements_promoteurs").select("echeance,statut,montant_mensuel").eq("promoteur_id", user.id).maybeSingle(),
  ]);
  const proofLinks = new Map<string, string>();
  const proofErrors = new Set<string>();
  await Promise.all((rows ?? []).map(async r => {
    const { data, error: proofError } = await db.storage.from("preuves-reglements-promoteurs").createSignedUrl(r.preuve_path, 600);
    if (data?.signedUrl) proofLinks.set(r.id, data.signedUrl);
    else if (proofError) proofErrors.add(r.id);
  }));
  const pending = !error && (rows ?? []).some(r => r.statut === "en_attente");
  const errors: Record<string, string> = {
    champs: "Vérifiez le montant et le canal de paiement.",
    canal: "Précisez le canal utilisé.",
    compte: "Le numéro de compte bancaire ou le numéro Orange Money / Mobile Money ayant effectué le paiement est obligatoire.",
    date: "Indiquez la date réelle du paiement. Elle ne peut pas être future.",
    preuve: "Joignez une preuve de paiement de 25 Mo maximum.",
    format: "Formats acceptés : PDF, JPEG, PNG, WebP, MP4, WebM ou MOV.",
    upload: "La preuve n’a pas pu être envoyée. Aucun paiement n’a été soumis.",
    deja_attente: "Un paiement est déjà en attente de vérification. Attendez la réponse de l’administrateur.",
    montant: "Le montant doit correspondre au tarif mensuel de votre convention.",
    soumission: "Le paiement n’a pas pu être soumis. Vérifiez les informations et réessayez.",
  };

  return <main className="min-h-screen bg-[#F4F8F5] px-4 py-6"><div className="mx-auto max-w-3xl space-y-4">
    <header className="rounded-3xl bg-[#0B3D26] p-5 text-white"><p className="text-xs uppercase tracking-[.18em] text-white/70">NAXA · Espace Promoteur</p><h1 className="mt-1 text-2xl font-black">Mon abonnement et mes paiements</h1><p className="mt-2 text-sm text-white/85">Payez par votre canal habituel, puis déclarez les références et transmettez votre preuve. L’administrateur vérifie l’encaissement avant tout renouvellement.</p></header>

    <section className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">État de l’abonnement</p><p className="mt-1 text-lg font-extrabold">{subscription?.statut === "actif" ? "Actif" : "À régulariser / en vérification"}</p><p className="mt-1 text-sm text-slate-600">Prochaine échéance : {subscription?.echeance ?? "Non configurée"} · Tarif mensuel : {subscription?.montant_mensuel ? money(subscription.montant_mensuel) : "Non configuré"}</p><p className="mt-2 text-xs text-slate-500">Après validation administrative, la prochaine échéance est calculée à 31 jours à compter de la date de validation.</p></section>

    {searchParams?.ok === "soumis" && <p role="status" className="rounded-2xl bg-white p-4 text-green-800">Votre paiement a été transmis à l’administrateur. Le renouvellement interviendra uniquement après vérification de l’encaissement.</p>}
    {searchParams?.erreur && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">{errors[searchParams.erreur] ?? "Une erreur est survenue."}</p>}
    {error && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">Le suivi des paiements est temporairement indisponible. L’historique et la possibilité de soumettre un nouveau règlement sont suspendus jusqu’au rétablissement du service.</p>}
    {subscriptionError && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">Les informations de votre abonnement n’ont pas pu être chargées. Aucun montant ne sera présumé : réessayez avant de soumettre un règlement.</p>}

    <section className="rounded-3xl bg-white p-4 sm:p-5">
      <h2 className="text-lg font-extrabold">Déclarer un paiement effectué</h2>
      <p className="mt-1 text-sm text-slate-600">Le paiement se fait directement par votre banque, Orange Money ou Mobile Money. NAXA ne débite pas votre compte depuis cette page.</p>
      {error || subscriptionError ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">La déclaration est temporairement désactivée car les données nécessaires n’ont pas pu être vérifiées.</p> : pending ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Un paiement est déjà en cours de vérification. Vous pourrez soumettre une nouvelle déclaration après son traitement.</p> : !subscription?.montant_mensuel ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Votre abonnement ou son tarif mensuel n’est pas configuré. Contactez l’administrateur avant tout règlement.</p> : <form action={soumettrePaiementPromoteur} encType="multipart/form-data" className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Montant payé (FCFA)<input required type="number" name="montant" min="1" step="1" inputMode="numeric" defaultValue={subscription?.montant_mensuel ?? ""} className="min-h-11 rounded-xl border border-slate-300 px-3"/></label>
        <label className="grid gap-1 text-sm font-semibold">Canal de paiement<select required name="canal" defaultValue="orange_money" className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="orange_money">Orange Money</option><option value="mtn_momo">MTN Mobile Money</option><option value="virement">Virement bancaire</option><option value="depot_bancaire">Dépôt bancaire</option><option value="especes">Espèces</option><option value="autre">Autre</option></select></label>
        <label className="grid gap-1 text-sm font-semibold">Précision si « Autre »<input name="canal_autre" maxLength={80} className="min-h-11 rounded-xl border border-slate-300 px-3" placeholder="Autre canal"/></label>
        <label className="grid gap-1 text-sm font-semibold">Compte / numéro ayant effectué le paiement<input required name="compte_payeur" maxLength={120} className="min-h-11 rounded-xl border border-slate-300 px-3" placeholder="N° Orange Money, MoMo ou compte bancaire"/></label>
        <label className="grid gap-1 text-sm font-semibold">Référence de transaction<input name="reference" maxLength={160} className="min-h-11 rounded-xl border border-slate-300 px-3" placeholder="Référence fournie par l’opérateur / la banque"/></label>
        <label className="grid gap-1 text-sm font-semibold">Date et heure du paiement<input required type="datetime-local" name="paye_le" className="min-h-11 rounded-xl border border-slate-300 px-3"/></label>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Preuve du paiement — photo, PDF ou vidéo (25 Mo maximum)<input required type="file" name="preuve" accept="application/pdf,image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" capture="environment" className="min-h-11 rounded-xl border border-slate-300 p-2"/><span className="text-xs font-normal text-slate-500">Vous pouvez joindre une capture, un document ou une vidéo filmée depuis votre téléphone.</span></label>
        <button className="min-h-11 rounded-full bg-[#0F6B3F] px-5 font-bold text-white sm:col-span-2">Soumettre le paiement à l’administrateur</button>
      </form>}
    </section>

    <section className="space-y-3"><h2 className="text-lg font-black">Historique et reçus</h2>
      {error ? <div role="alert" className="rounded-2xl bg-white p-5 text-red-700">L’historique ne peut pas être affiché tant que la lecture des règlements est en erreur. Aucune absence de paiement n’est déduite.</div> : !rows?.length ? <div className="rounded-2xl bg-white p-5"><p className="font-bold">Aucun paiement déclaré.</p><p className="mt-1 text-sm text-slate-600">Après soumission, le statut de vérification apparaîtra ici.</p></div> : rows.map(r => <article key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-extrabold">{money(r.montant)}</p><p className="mt-1 text-xs text-slate-500">Soumis le {dt(r.created_at)}</p></div><span className={"rounded-full px-3 py-1 text-xs font-bold " + (r.statut === "confirme" ? "bg-green-100 text-green-800" : r.statut === "conteste" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900")}>{r.statut === "confirme" ? "Confirmé" : r.statut === "conteste" ? "À corriger" : "En attente de vérification"}</span></div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Canal</dt><dd className="font-semibold">{LABEL[r.canal] ?? r.canal}{r.canal_autre ? " · " + r.canal_autre : ""}</dd></div><div><dt className="text-slate-500">Compte payeur</dt><dd className="font-semibold">{r.compte_payeur || "—"}</dd></div><div><dt className="text-slate-500">Référence</dt><dd className="font-semibold">{r.reference || "—"}</dd></div><div><dt className="text-slate-500">Date réelle déclarée</dt><dd className="font-semibold">{dt(r.paye_le)}</dd></div><div><dt className="text-slate-500">Date de validation</dt><dd className="font-semibold">{dt(r.confirme_le)}</dd></div>{r.periode_du && <div><dt className="text-slate-500">Période après validation</dt><dd className="font-semibold">{r.periode_du + " → " + r.periode_au}</dd></div>}</dl>
        {proofLinks.get(r.id) ? <a className="mt-3 inline-block text-sm font-bold text-[#0147BB] underline" href={proofLinks.get(r.id)} target="_blank" rel="noreferrer">Consulter ma preuve</a> : <p role="status" className="mt-3 text-xs text-amber-800">{proofErrors.has(r.id) ? "La preuve existe dans le dossier, mais son lien sécurisé est temporairement indisponible. Réessayez plus tard." : "Aucun lien temporaire vers la preuve n’a été généré."}</p>}
        {r.statut === "conteste" && r.motif_contestation && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900"><strong>Correction demandée :</strong> {r.motif_contestation}</p>}
        {r.statut === "confirme" && <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600">ID paiement : {r.identifiant_paiement ?? "—"} · Reçu : {r.numero_recu ?? "—"}</p><Link className="rounded-full bg-[#0F6B3F] px-4 py-2 text-sm font-bold text-white" href={"/promoteur/paiements/" + r.id + "/recu"}>Télécharger / imprimer le reçu</Link></div>}
      </article>)}
    </section>
  </div></main>;
}
