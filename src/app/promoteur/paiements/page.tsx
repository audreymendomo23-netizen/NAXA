import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import { deposerPreuveComplementaire, soumettrePaiementPromoteur } from "./actions";
import { PaymentIntentPanel } from "@/components/promoteur/PaymentIntentPanel";

const LABEL: Record<string, string> = {
  orange_money: "Orange Money", mtn_momo: "MTN Mobile Money",
};
const money = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const dt = (s: string | null) => s ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Douala" }).format(new Date(s)) : "—";

export default async function PromoteurPaiementsPage({ searchParams }: { searchParams?: Promise<{ ok?: string; erreur?: string }> }) {
  const filters = await searchParams;
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return <main className="mx-auto max-w-2xl p-4"><section className="rounded-2xl bg-white p-5">Connectez-vous pour consulter et soumettre vos règlements.</section></main>;
  const { data: profile } = await sb.from("profiles").select("role,first_name,last_name,username").eq("id", user.id).maybeSingle();
  if (profile?.role !== "promoteur") return <main className="mx-auto max-w-2xl p-4"><section className="rounded-2xl bg-white p-5">Cette page est réservée à l’espace Promoteur.</section></main>;

  const db = supabaseAdmin();
  const [{ data: rows, error }, { data: subscription, error: subscriptionError }, { data: destinationsRows, error: destinationsError }] = await Promise.all([
    db.from("abonnement_promoteur_reglements").select("id,montant,canal,canal_autre,compte_payeur,reference,paye_le,statut,numero_recu,identifiant_paiement,periode_du,periode_au,created_at,declared_at,confirme_le,preuve_path,destination_snapshot,motif_contestation,verification_deadline_at,verification_level,verification_status,verification_details").eq("promoteur_id", user.id).order("created_at", { ascending: false }).limit(100),
    db.from("abonnements_promoteurs").select("echeance,statut,montant_mensuel").eq("promoteur_id", user.id).maybeSingle(),
    db.from("naxa_payment_destinations").select("canal,beneficiaire,reference_destination,instructions,actif").eq("actif", true),
  ]);
  const destinations = new Map((destinationsRows ?? []).map((row) => [row.canal, row]));
  const destinationsReady = ["orange_money", "mtn_momo"].some((canal) => destinations.has(canal));
  const proofLinks = new Map<string, string>();
  const proofErrors = new Set<string>();
  await Promise.all((rows ?? []).filter(r => Boolean(r.preuve_path)).map(async r => {
    const { data, error: proofError } = await db.storage.from("preuves-reglements-promoteurs").createSignedUrl(r.preuve_path!, 600);
    if (data?.signedUrl) proofLinks.set(r.id, data.signedUrl);
    else if (proofError) proofErrors.add(r.id);
  }));
  const pending = !error && (rows ?? []).some(r => r.statut === "en_attente" || r.statut === "non_confirme");
  const activeChannels = ["orange_money", "mtn_momo"].filter((canal) => destinations.has(canal));
  const destinationsAvailable = !destinationsError && destinationsReady;
  const { data: activeIntent } = await db.from("naxa_promoteur_payment_intents")
    .select("id,canal,expected_amount,destination_snapshot,expires_at,status,device_id")
    .eq("promoteur_id", user.id).eq("status", "awaiting_payment")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: paymentDevice } = activeIntent?.device_id
    ? await db.from("naxa_promoteur_payment_devices")
        .select("id,device_name").eq("id", activeIntent.device_id)
        .eq("promoteur_id", user.id).eq("is_active", true).maybeSingle()
    : await db.from("naxa_promoteur_payment_devices")
        .select("id,device_name").eq("promoteur_id", user.id).eq("is_active", true)
        .order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  const errors: Record<string, string> = {
    champs: "Vérifiez le montant et le canal de paiement.",
    canal: "Précisez un canal configuré par NAXA.",
    reference: "La référence de transaction Mobile Money est obligatoire.",
    compte: "Le numéro Orange Money ou MTN Mobile Money ayant effectué le paiement est obligatoire.",
    reference_deja_utilisee: "Cette référence a déjà été utilisée dans NAXA. Vérifiez votre transaction avant toute nouvelle soumission.",
    date: "Indiquez la date réelle du paiement. Elle ne peut pas être future.",
    preuve: "Joignez une image ou un PDF de 25 Mo maximum.",
    format: "Formats acceptés pour la preuve complémentaire : PDF, JPEG, PNG ou WebP.",
    upload: "La preuve complémentaire n’a pas pu être envoyée.",
    preuve_trop_tot: "La preuve complémentaire n’est pas disponible pour cette déclaration.",
    preuve_indisponible: "La déclaration ne permet plus de joindre une preuve complémentaire.",
    destination: "Le canal sélectionné n’a pas de destination active configurée par NAXA.",
    deja_attente: "Un paiement est déjà en attente de vérification. Attendez la réponse de l’administrateur.",
    montant: "Le montant doit correspondre au tarif mensuel de votre convention.",
    soumission: "Le paiement n’a pas pu être soumis. Vérifiez les informations et réessayez.",
    nettoyage_preuve: "La soumission a été refusée, mais le nettoyage automatique de la preuve n’a pas pu être confirmé. L’incident a été consigné pour traitement administratif ; ne renvoyez pas le même paiement avant vérification.",
  };

  return <main className="min-h-screen bg-[#F4F8F5] px-4 py-6"><div className="mx-auto max-w-3xl space-y-4">
    <header className="rounded-3xl bg-[#0B3D26] p-5 text-white"><p className="text-xs uppercase tracking-[.18em] text-white/70">NAXA · Espace Promoteur</p><h1 className="mt-1 text-2xl font-black">Mon abonnement et mes paiements</h1><p className="mt-2 text-sm text-white/85">Payez par MTN ou Orange Money. NAXA vérifie le SMS sur le téléphone du payeur, puis celui du bénéficiaire Admin en secours. Vous pouvez aussi transmettre immédiatement le SMS et un justificatif pour analyse pendant 24 heures ; aucun renouvellement ne se fait sans confirmation de l’encaissement.</p></header>

    <section className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">État de l’abonnement</p><p className="mt-1 text-lg font-extrabold">{subscription?.statut === "actif" ? "Actif" : "À régulariser / en vérification"}</p><p className="mt-1 text-sm text-slate-600">Prochaine échéance : {subscription?.echeance ?? "Non configurée"} · Tarif mensuel : {subscription?.montant_mensuel ? money(subscription.montant_mensuel) : "Non configuré"}</p><p className="mt-2 text-xs text-slate-500">Après déclaration d’un paiement, une tolérance de vérification de 24 heures peut préserver un accès encore actif. Ce délai ne confirme pas le paiement et ne renouvelle pas l’abonnement.</p></section>

    {filters?.ok === "soumis" && <p role="status" className="rounded-2xl bg-white p-4 text-green-800">Votre paiement a été transmis à l’administrateur. Le renouvellement interviendra uniquement après vérification de l’encaissement.</p>}
    {filters?.erreur && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">{errors[filters.erreur] ?? "Une erreur est survenue."}</p>}
    {error && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">Le suivi des paiements est temporairement indisponible. L’historique et la possibilité de soumettre un nouveau règlement sont suspendus jusqu’au rétablissement du service.</p>}
    {subscriptionError && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">Les informations de votre abonnement n’ont pas pu être chargées. Aucun montant ne sera présumé : réessayez avant de soumettre un règlement.</p>}

    <section className="rounded-3xl bg-white p-4 sm:p-5">
      <h2 className="text-lg font-extrabold">1. Effectuer le paiement externe</h2>
      <p className="mt-1 text-sm text-slate-600">NAXA ne débite pas votre compte. Utilisez uniquement les coordonnées administrées ci-dessous ; payez le montant exact de votre abonnement.</p>
      {destinationsError && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Les destinations de paiement ne peuvent pas être chargées. Ne procédez à aucun paiement avant leur rétablissement.</p>}
      {!destinationsError && <div className="mt-3 grid gap-3 sm:grid-cols-3">{["orange_money", "mtn_momo"].map((canal) => { const d = destinations.get(canal); return <article key={canal} className="rounded-xl border border-slate-200 p-3"><p className="font-bold">{LABEL[canal]}</p>{d ? <>{<p className="mt-2 text-xs text-slate-500">Bénéficiaire</p>}<p className="font-semibold">{d.beneficiaire}</p><p className="mt-2 text-xs text-slate-500">Code marchand</p><p className="break-all font-bold">{d.reference_destination}</p>{d.instructions && <p className="mt-2 text-xs text-slate-600">{d.instructions}</p>}</> : <p className="mt-2 text-sm text-amber-800">Destination non configurée par NAXA.</p>}</article>; })}</div>}
      <PaymentIntentPanel
        device={paymentDevice ? { id: paymentDevice.id, name: paymentDevice.device_name } : null}
        activeIntent={activeIntent ? {
          id: activeIntent.id,
          canal: activeIntent.canal,
          expectedAmount: activeIntent.expected_amount,
          destination: activeIntent.destination_snapshot,
          expiresAt: activeIntent.expires_at,
        } : null}
        
      />
      <h2 className="mt-6 text-lg font-extrabold">3. Soumettre les éléments pour analyse</h2>
      <p className="mt-1 text-sm text-slate-600">En cas d’échec des deux contrôles automatiques, ou immédiatement si vous disposez des éléments, collez le SMS reçu et joignez le justificatif. L’IA extrait les données ; les règles contrôlent le montant, la référence, le bénéficiaire et les dates. Une soumission manuelle ne confirme jamais seule le paiement.</p>
      {error || subscriptionError ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">La déclaration est temporairement désactivée car les données nécessaires n’ont pas pu être vérifiées.</p> : pending ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Un paiement est déjà en cours de vérification. Vous pourrez soumettre une nouvelle déclaration après son traitement.</p> : !subscription?.montant_mensuel ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Votre abonnement ou son tarif mensuel n’est pas configuré. Contactez l’administrateur avant tout règlement.</p> : !destinationsAvailable ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Aucun canal de paiement n’est configuré. Contactez NAXA ; ne payez pas sur une ancienne destination.</p> : <form action={soumettrePaiementPromoteur} encType="multipart/form-data" className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Montant payé (FCFA)<input required type="number" name="montant" min="1" step="1" inputMode="numeric" defaultValue={subscription?.montant_mensuel ?? ""} className="min-h-11 rounded-xl border border-slate-300 px-3"/></label>
        <label className="grid gap-1 text-sm font-semibold">Canal de paiement<select required name="canal" defaultValue="orange_money" className="min-h-11 rounded-xl border border-slate-300 px-3">{["orange_money", "mtn_momo"].filter((canal) => destinations.has(canal)).map((canal) => <option key={canal} value={canal}>{LABEL[canal]}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">Compte / numéro ayant effectué le paiement<input required name="compte_payeur" maxLength={120} className="min-h-11 rounded-xl border border-slate-300 px-3" placeholder="N° Orange Money ou MTN MoMo"/></label>
        <label className="grid gap-1 text-sm font-semibold">Référence de transaction<input required name="reference" minLength={3} maxLength={160} className="min-h-11 rounded-xl border border-slate-300 px-3" placeholder="Référence MTN ou Orange"/></label>
        <label className="grid gap-1 text-sm font-semibold">Date et heure du paiement<input required type="datetime-local" name="paye_le" className="min-h-11 rounded-xl border border-slate-300 px-3"/></label>
        <label className="grid gap-1 text-sm font-semibold">Expéditeur SMS affiché
          <input name="sms_expediteur" maxLength={80} className="min-h-11 rounded-xl border border-slate-300 px-3" placeholder="OrangeMoney ou MobileMoney"/>
        </label>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Contenu du SMS reçu (français ou anglais)
          <textarea name="sms_message" maxLength={8000} rows={5} className="rounded-xl border border-slate-300 p-3 font-normal" placeholder="Collez le SMS reçu par votre téléphone. Ne saisissez jamais votre PIN ou un OTP."/>
        </label>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Justificatif (capture d’écran, PDF ou image)
          <input type="file" name="preuve" accept="application/pdf,image/jpeg,image/png,image/webp" className="min-h-11 rounded-xl border border-slate-300 p-2"/>
        </label>

        <p className="text-xs text-slate-500 sm:col-span-2">Le justificatif peut être joint dès la déclaration. Les données du SMS sont conservées sous forme de champs extraits, pas sous forme de conversation brute.</p>
        <button className="min-h-11 rounded-full bg-[#0F6B3F] px-5 font-bold text-white sm:col-span-2">Paiement effectué — déclarer la transaction</button>
      </form>}
    </section>

    <section className="space-y-3"><h2 className="text-lg font-black">Historique et reçus</h2>
      {error ? <div role="alert" className="rounded-2xl bg-white p-5 text-red-700">L’historique ne peut pas être affiché tant que la lecture des règlements est en erreur. Aucune absence de paiement n’est déduite.</div> : !rows?.length ? <div className="rounded-2xl bg-white p-5"><p className="font-bold">Aucun paiement déclaré.</p><p className="mt-1 text-sm text-slate-600">Après soumission, le statut de vérification apparaîtra ici.</p></div> : rows.map(r => <article key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-extrabold">{money(r.montant)}</p><p className="mt-1 text-xs text-slate-500">Déclaration reçue (T0) : {dt(r.declared_at ?? r.created_at)}</p></div><span className={"rounded-full px-3 py-1 text-xs font-bold " + (r.statut === "confirme" ? "bg-green-100 text-green-800" : r.statut === "conteste" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900")}>{r.statut === "confirme" ? "Confirmé" : r.statut === "conteste" ? "À corriger" : r.statut === "non_confirme" ? "Non confirmé — détection toujours active" : "En attente de confirmation"}</span></div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Canal</dt><dd className="font-semibold">{LABEL[r.canal] ?? r.canal}{r.canal_autre ? " · " + r.canal_autre : ""}</dd></div><div><dt className="text-slate-500">Compte payeur</dt><dd className="font-semibold">{r.compte_payeur || "—"}</dd></div><div><dt className="text-slate-500">Référence</dt><dd className="font-semibold">{r.reference || "—"}</dd></div><div><dt className="text-slate-500">Date réelle déclarée</dt><dd className="font-semibold">{dt(r.paye_le)}</dd></div><div><dt className="text-slate-500">Fin du délai de vérification</dt><dd className="font-semibold">{dt(r.verification_deadline_at)}</dd></div><div><dt className="text-slate-500">Niveau contrôlé</dt><dd className="font-semibold">{r.verification_level ?? 0} / 3 · {r.verification_status ?? "pending"}</dd></div><div><dt className="text-slate-500">Date de validation</dt><dd className="font-semibold">{dt(r.confirme_le)}</dd></div>{r.periode_du && <div><dt className="text-slate-500">Période après validation</dt><dd className="font-semibold">{r.periode_du + " → " + r.periode_au}</dd></div>}</dl>
        {proofLinks.get(r.id) ? <a className="mt-3 inline-block text-sm font-bold text-[#0147BB] underline" href={proofLinks.get(r.id)} target="_blank" rel="noreferrer">Consulter ma preuve</a> : <p role="status" className="mt-3 text-xs text-amber-800">{proofErrors.has(r.id) ? "La preuve existe dans le dossier, mais son lien sécurisé est temporairement indisponible. Réessayez plus tard." : "Aucun lien temporaire vers la preuve n’a été généré."}</p>}
        {r.destination_snapshot && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs"><p className="font-bold">Destination utilisée lors de la déclaration</p><p>{r.destination_snapshot.beneficiaire} · {r.destination_snapshot.reference_destination}</p></div>}
        {Array.isArray(r.verification_details?.reasons) && r.verification_details.reasons.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-950"><p className="font-bold">Points à vérifier</p><ul className="mt-1 list-disc pl-5">{r.verification_details.reasons.map((reason: string, index: number) => <li key={index}>{reason}</li>)}</ul></div>}
        {r.statut !== "confirme" && r.statut !== "conteste" && !r.preuve_path && r.verification_deadline_at && Date.now() < new Date(r.verification_deadline_at).getTime() && <form action={deposerPreuveComplementaire} encType="multipart/form-data" className="mt-3 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3"><input type="hidden" name="reglement_id" value={r.id}/><p className="text-sm font-semibold">Vous pouvez ajouter un justificatif complémentaire pendant les 24 heures de vérification.</p><input required type="file" name="preuve" accept="application/pdf,image/jpeg,image/png,image/webp" className="min-h-11 rounded-xl border border-amber-300 bg-white p-2"/><button className="min-h-10 w-fit rounded-full bg-[#0F6B3F] px-4 text-sm font-bold text-white">Envoyer la preuve complémentaire</button></form>}
        {r.statut === "conteste" && r.motif_contestation && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900"><strong>Correction demandée :</strong> {r.motif_contestation}</p>}
        {r.statut === "confirme" && <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600">ID paiement : {r.identifiant_paiement ?? "—"} · Reçu : {r.numero_recu ?? "—"}</p><Link className="rounded-full bg-[#0F6B3F] px-4 py-2 text-sm font-bold text-white" href={"/promoteur/paiements/" + r.id + "/recu"}>Télécharger / imprimer le reçu</Link></div>}
      </article>)}
    </section>
  </div></main>;
}
