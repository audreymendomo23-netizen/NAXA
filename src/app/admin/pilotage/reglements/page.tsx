import Image from "next/image";
import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PromoteurPaymentProofOcr } from "@/components/admin/PromoteurPaymentProofOcr";
import { confirmerReglementPromoteur, contesterReglementPromoteur } from "./actions";

type SearchParams = Promise<{ ok?: string; erreur?: string }>;
const CANAUX: Record<string, string> = {
  especes: "Espèces", orange_money: "Orange Money", mtn_momo: "MTN Mobile Money",
  virement: "Virement bancaire", depot_bancaire: "Dépôt bancaire", autre: "Autre",
};
const money = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const date = (s: string | null) => s ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Douala" }).format(new Date(s)) : "—";

export default async function ReglementsAdminPage({ searchParams }: { searchParams?: SearchParams }) {
  const query = await searchParams;
  await requireAdminActive("/admin/pilotage/reglements");
  const db = supabaseAdmin();
  const [{ data: pending, error: pendingError }, { data: recent, error: recentError }, { data: adminSmsEvents, error: adminSmsEventsError }, { data: collectedEvidence, error: collectedEvidenceError }] = await Promise.all([
    db.from("abonnement_promoteur_reglements").select("id,promoteur_id,montant,canal,canal_autre,compte_payeur,reference,paye_le,preuve_path,destination_snapshot,declared_at,created_at,verification_deadline_at,verification_level,verification_status,verification_details").eq("statut", "en_attente").order("created_at", { ascending: true }).limit(100),
    db.from("abonnement_promoteur_reglements").select("id,promoteur_id,montant,canal,canal_autre,compte_payeur,reference,paye_le,statut,numero_recu,identifiant_paiement,periode_au,declared_at,destination_snapshot,created_at,motif_contestation").neq("statut", "en_attente").order("created_at", { ascending: false }).limit(50),
    db.from("naxa_admin_payment_capture_events").select("id,canal,transaction_reference,amount,payer_number,merchant_reference,sender_origin_id,sms_received_at,match_status,reglement_id").order("created_at", { ascending: false }).limit(50),
    db.from("naxa_payment_evidence_intake").select("id,workspace_type,workspace_id,canal,source_type,source_package,direction,success,amount,transaction_reference,payer_number_tail,merchant_number_tail,merchant_label,provider_occurred_at,match_status,received_at").order("received_at", { ascending: false }).limit(100),
  ]);
  const paymentRows = [...(pending ?? []), ...(recent ?? [])];
  const promoterIds = [...new Set(paymentRows.map(r => r.promoteur_id).filter((id): id is string => typeof id === "string" && id.length > 0))];
  let promoterRows: { id: string; first_name: string | null; last_name: string | null; username: string | null }[] = [];
  let promoterLookupError: unknown = null;
  if (promoterIds.length) {
    const promoterResult = await db.from("profiles")
      .select("id,first_name,last_name,username")
      .eq("role", "promoteur")
      .in("id", promoterIds);
    promoterRows = promoterResult.data ?? [];
    promoterLookupError = promoterResult.error;
  }
  const people = new Map(promoterRows.map(p => [
    p.id,
    [p.first_name, p.last_name].filter(Boolean).join(" ") || p.username || null,
  ]));
  let links: { promoteur_id: string; pharmacie_id: string }[] = [];
  let linksError: unknown = null;
  if (promoterIds.length) {
    const linkResult = await db.from("promoteur_pharmacies").select("promoteur_id,pharmacie_id").in("promoteur_id", promoterIds);
    links = linkResult.data ?? [];
    linksError = linkResult.error;
  }
  const pharmacyIds = [...new Set(links.map(l => l.pharmacie_id).filter(Boolean))];
  let pharmacyRows: { id: string; nom: string }[] = [];
  let pharmacyRowsError: unknown = null;
  if (pharmacyIds.length) {
    const pharmacyResult = await db.from("pharmacies").select("id,nom").in("id", pharmacyIds);
    pharmacyRows = pharmacyResult.data ?? [];
    pharmacyRowsError = pharmacyResult.error;
  }
  const pharmaciesUnavailable = Boolean(linksError || pharmacyRowsError);
  const pharmacyNamesById = new Map(pharmacyRows.map(p => [p.id, p.nom]));
  const unresolvedPharmacyLinks = links.some(link => !pharmacyNamesById.has(link.pharmacie_id));
  const pharmaciesByPromoter = new Map<string, string[]>();
  for (const link of links) {
    const name = pharmacyNamesById.get(link.pharmacie_id);
    if (!name) continue;
    const names = pharmaciesByPromoter.get(link.promoteur_id) ?? [];
    if (!names.includes(name)) names.push(name);
    pharmaciesByPromoter.set(link.promoteur_id, names);
  }
  for (const names of pharmaciesByPromoter.values()) names.sort((a, b) => a.localeCompare(b, "fr"));
  const pharmacyLabel = (promoteurId: string) => {
    if (pharmaciesUnavailable || unresolvedPharmacyLinks) return "Indisponible — vérifier le dossier pharmacie";
    const names = pharmaciesByPromoter.get(promoteurId) ?? [];
    return names.length ? names.join(", ") : "Aucune pharmacie rattachée";
  };
  const paymentContextUnavailable = Boolean(
    promoterLookupError ||
    pharmaciesUnavailable ||
    unresolvedPharmacyLinks ||
    (pending ?? []).some(r => !people.get(r.promoteur_id) || !(pharmaciesByPromoter.get(r.promoteur_id)?.length))
  );
  const promoterLabel = (promoteurId: string) => people.get(promoteurId) || "Identité du Promoteur indisponible";
  const proofLinks = new Map<string, string>();
  await Promise.all((pending ?? []).filter(r => Boolean(r.preuve_path)).map(async r => {
    const { data } = await db.storage.from("preuves-reglements-promoteurs").createSignedUrl(r.preuve_path!, 600);
    if (data?.signedUrl) proofLinks.set(r.id, data.signedUrl);
  }));
  const errors: Record<string, string> = {
    champs: "Le règlement sélectionné est invalide.",
    preuve: "La preuve privée est inaccessible. Le paiement ne peut pas être confirmé sans vérification.",
    confirmation: "La confirmation a échoué. Aucun renouvellement n’a été confirmé.",
    verification: "Cochez la confirmation après avoir consulté la preuve et vérifié l’encaissement réel.",
    motif: "Un motif de contestation de 5 à 500 caractères est requis.",
    contestation: "La contestation n’a pas pu être enregistrée.",
  };
  return <main className="min-h-screen bg-[#ACDC76] p-3 sm:p-6"><div className="mx-auto max-w-6xl space-y-4">
    <header className="rounded-3xl bg-black p-5 text-white">
      <p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Pilotage réseau</p>
      <h1 className="mt-1 text-2xl font-black text-[#D95304]">Vérification des paiements Promoteurs</h1>
      <p className="mt-2 text-sm text-white/80">Le Promoteur déclare son paiement et transmet la preuve. Vous vérifiez les références et l’encaissement réel avant de confirmer. La confirmation renouvelle l’abonnement sur une période mensuelle et génère le reçu.</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold"><Link href="/admin/pilotage/reglements/configuration" className="underline">Configurer les destinations de paiement</Link><Link href="/admin/pilotage/validite" className="underline">Retour à la validité</Link></div>
    </header>
    {query?.ok && <p role="status" className="rounded-2xl bg-white p-4 text-green-800">{query?.ok === "confirme" ? "Paiement confirmé, abonnement renouvelé et reçu disponible dans l’espace Promoteur." : "Règlement mis à jour."}</p>}
    {query?.erreur && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">{errors[query?.erreur] ?? "Une erreur est survenue."}</p>}
    {paymentContextUnavailable && <p role="alert" className="rounded-2xl border border-amber-300 bg-white p-4 text-sm text-amber-900">L’identité du Promoteur ou la liste de ses pharmacies rattachées est incomplète. La confirmation est désactivée jusqu’à ce que le dossier soit entièrement vérifiable.</p>}
    <section className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black">SMS reçus sur le téléphone Admin ({adminSmsEvents?.length ?? 0})</h2>
        <span className="text-xs text-slate-500">Contrôle de secours · Orange Money / MTN Mobile Money</span>
      </div>
      {adminSmsEventsError && <p role="alert" className="text-sm text-red-700">Les événements SMS Admin n'ont pas pu être chargés.</p>}
      {!adminSmsEventsError && !adminSmsEvents?.length && <p className="text-sm text-slate-600">Aucun SMS marchand capturé. Enrôlez le téléphone Admin dans le compagnon NAXA pour activer le deuxième contrôle.</p>}
      {!adminSmsEventsError && adminSmsEvents?.map(event => <article key={event.id} className="rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">{event.canal === "orange_money" ? "Orange Money" : "MTN Mobile Money"} · {money(event.amount)}</p>
          <span className={"rounded-full px-2 py-1 text-xs font-bold " + (event.match_status === "confirmed" ? "bg-green-100 text-green-800" : event.match_status === "manual_review" || event.match_status === "ambiguous" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700")}>
            {event.match_status === "confirmed" ? "Abonnement renouvelé" : event.match_status === "ambiguous" ? "Plusieurs dossiers possibles" : event.match_status === "manual_review" ? "Revue manuelle" : event.match_status === "matched" ? "Rapproché" : event.match_status}
          </span>
        </div>
        <p className="mt-1 break-all text-sm">Référence : <strong>{event.transaction_reference}</strong></p>
        <p className="text-xs text-slate-600">Expéditeur : {event.sender_origin_id === "MANUAL_SHARE" ? "Partage manuel Admin" : event.sender_origin_id} · Payeur : {event.payer_number ?? "—"} · Reçu : {date(event.sms_received_at)}</p>
        <p className="text-xs text-slate-600">Destination : {event.merchant_reference}</p>
        {event.reglement_id
          ? <Link href={"/admin/pilotage/reglements#paiement-" + event.reglement_id} className="mt-2 inline-block text-sm font-bold text-[#0147BB] underline">Ouvrir le dossier de paiement</Link>
          : <p className="mt-2 text-xs font-semibold text-amber-900">Aucun dossier unique identifié. Ce SMS partagé manuellement ou cette réception sans déclaration Promoteur ne crée pas de règlement. Le rapprochement manuel reste nécessaire.</p>}
      </article>)}
    </section>
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black">Preuves reçues du lecteur Android et SMS partagés ({collectedEvidence?.length ?? 0})</h2>
        <span className="text-xs text-slate-500">Pharmacie · Partenaire · Admin</span>
      </div>
      {collectedEvidenceError && <p role="alert" className="text-sm text-amber-900">Le registre de collecte n'est pas disponible. Vérifiez l'application de la migration dédiée sur Replay.</p>}
      {!collectedEvidenceError && !collectedEvidence?.length && <p className="text-sm text-slate-600">Aucun nouvel élément de collecte.</p>}
      {!collectedEvidenceError && collectedEvidence?.map((event) => <article key={event.id} className="rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">{event.workspace_type === "pharmacie" ? "Pharmacie" : event.workspace_type === "partner" ? "Partenaire" : "Administrateur"} · {event.canal === "orange_money" ? "Orange Money" : "MTN Mobile Money"} · {event.amount ? money(event.amount) : "Montant non extrait"}</p>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-950">À rapprocher · {event.match_status}</span>
        </div>
        <p className="mt-1 break-all text-sm">Référence : <strong>{event.transaction_reference ?? "Non extraite"}</strong> · Mouvement : {event.direction} · Succès détecté : {event.success ? "Oui" : "Non / inconnu"}</p>
        <p className="text-xs text-slate-600">Source : {event.source_type === "notification" ? "Notification " + (event.source_package ?? "application inconnue") : "SMS partagé volontairement"} · Espace : {event.workspace_id} · Payeur : …{event.payer_number_tail ?? "—"} · Marchand : …{event.merchant_number_tail ?? "—"}</p>
        <p className="text-xs text-slate-600">Date opérateur : {date(event.provider_occurred_at)} · Reçu : {date(event.received_at)}</p>
        <p className="mt-2 text-xs font-semibold text-amber-900">Élément de collecte uniquement : aucune confirmation ni activation d'abonnement n'a été effectuée.</p>
      </article>)}
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-black">Paiements à vérifier ({pending?.length ?? 0})</h2>
      {pendingError && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">Impossible de charger les paiements à vérifier.</p>}
      {!pendingError && !pending?.length && <p className="rounded-2xl bg-white p-4 text-sm text-slate-600">Aucun paiement en attente de vérification.</p>}
      {(pending ?? []).map(r => {
        const proof = proofLinks.get(r.id);
        const isVideo = /\.(mp4|webm|mov)$/i.test(r.preuve_path);
        return <article id={"paiement-" + r.id} key={r.id} className="rounded-3xl bg-white p-4 sm:p-5">
          <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-extrabold">{promoterLabel(r.promoteur_id)}</h3><p className="mt-1 break-words text-sm text-slate-700">Pharmacie(s) : <span className="font-semibold">{pharmacyLabel(r.promoteur_id)}</span></p><p className="text-xs text-slate-500">Déclaration reçue (T0) : {date(r.declared_at ?? r.created_at)}</p></div><strong className="text-lg">{money(r.montant)}</strong></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-slate-500">Canal de paiement</dt><dd className="font-semibold">{CANAUX[r.canal] ?? r.canal}{r.canal_autre ? " · " + r.canal_autre : ""}</dd></div>
            <div><dt className="text-slate-500">Compte / numéro payeur</dt><dd className="font-semibold">{r.compte_payeur || "—"}</dd></div>
            <div><dt className="text-slate-500">Référence de transaction</dt><dd className="font-semibold">{r.reference || "Non renseignée"}</dd></div>
            <div><dt className="text-slate-500">Date de paiement déclarée</dt><dd className="font-semibold">{date(r.paye_le)}</dd></div><div><dt className="text-slate-500">Destination utilisée</dt><dd className="font-semibold">{r.destination_snapshot ? `${r.destination_snapshot.beneficiaire} · ${r.destination_snapshot.reference_destination}` : "Instantané non disponible"}</dd></div>
            <div><dt className="text-slate-500">Fin de la tolérance</dt><dd className="font-semibold">{date(r.verification_deadline_at)}</dd></div>
          </dl>
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm">
            <p className="font-bold text-sky-950">Analyse algorithmique · Niveau {r.verification_level ?? 0}/3</p>
            <p className="mt-1 text-sky-900">État : {r.verification_status ?? "pending"} · Analyseur : {r.verification_details?.parser ?? "non exécuté"} · Qualité : {r.verification_details?.quality ?? "inconnue"}</p>
            <p className="mt-1 text-sky-900">Type : {r.verification_details?.direction ?? "non identifié"} · Montant extrait : {r.verification_details?.amount ?? "—"} FCFA · Référence extraite : {r.verification_details?.extractedReference ?? "—"}</p>
            {Array.isArray(r.verification_details?.reasons) && r.verification_details.reasons.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sky-900">{r.verification_details.reasons.map((reason: string, index: number) => <li key={index}>{reason}</li>)}</ul>}
            <p className="mt-2 text-xs text-sky-900">L’analyse aide au rapprochement. La validation finale exige encore le contrôle de l’encaissement réel par l’Administrateur.</p>
          </div>
          {proof && <div className="mt-4 rounded-2xl border border-slate-200 p-3">
            {isVideo && <video controls preload="metadata" className="mb-3 max-h-80 w-full rounded-xl bg-black" src={proof}>Votre navigateur ne peut pas lire cette vidéo.</video>}
            {!isVideo && /\.(jpg|jpeg|png|webp)$/i.test(r.preuve_path) && <a href={proof} target="_blank" rel="noreferrer"><Image width={1280} height={800} unoptimized src={proof} alt="Preuve du paiement envoyée par le Promoteur" className="mb-3 max-h-80 max-w-full rounded-xl object-contain" /></a>}
            <a className="inline-block rounded-full border border-[#0147BB] px-4 py-2 text-sm font-bold text-[#0147BB] underline" href={proof} target="_blank" rel="noreferrer" download>Consulter / télécharger la preuve privée</a>
            <p className="mt-2 text-xs text-slate-500">Lien privé temporaire, valable 10 minutes. Renouvelez la page si nécessaire.</p>
            {!isVideo && <PromoteurPaymentProofOcr proofUrl={proof} reglementId={r.id}/>}

          </div>}
          {!proof && <p className="mt-3 text-sm text-amber-800">{r.preuve_path ? "La preuve complémentaire déposée n’a pas pu être chargée. Vous pouvez procéder uniquement après vérification externe complète." : "Aucune preuve complémentaire n’a encore été déposée. Vérifiez directement la transaction auprès de l’opérateur ou de la banque."}</p>}
          <form action={confirmerReglementPromoteur} className="mt-4"><input type="hidden" name="reglement_id" value={r.id}/><label className="mb-3 flex items-start gap-2 text-sm"><input required type="checkbox" name="preuve_verifiee" className="mt-1 h-4 w-4 accent-[#0F6B3F]"/><span>J’ai vérifié directement auprès de l’opérateur ou de la banque la réalité de l’encaissement, le montant, le canal, le compte payeur, la destination et la référence exacte de cette transaction.</span></label><button disabled={paymentContextUnavailable} className="min-h-11 rounded-full bg-[#0F6B3F] px-5 font-bold text-white disabled:opacity-40">Confirmer l’encaissement réel et renouveler l’abonnement</button><p className="mt-2 text-xs text-slate-500">Cette action est définitive et journalisée. Elle met à jour l’échéance à partir de la date de validation.</p></form>
          <form action={contesterReglementPromoteur} className="mt-4 grid gap-2 rounded-2xl border border-red-100 bg-red-50 p-3"><input type="hidden" name="reglement_id" value={r.id}/><label className="grid gap-1 text-sm font-semibold text-red-900">Contester / demander une correction<textarea required minLength={5} maxLength={500} name="motif" className="min-h-20 rounded-xl border border-red-200 bg-white p-3 font-normal" placeholder="Précisez la référence ou l’élément à corriger."/></label><button className="min-h-10 w-fit rounded-full border border-red-300 px-4 font-bold text-red-800">Contester le paiement</button></form>
        </article>;
      })}
    </section>
    <section className="space-y-3"><h2 className="text-xl font-black">Historique des paiements traités</h2>
      {recentError && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">Impossible de charger l’historique des paiements traités.</p>}
      {!recentError && !recent?.length ? <p className="rounded-2xl bg-white p-4 text-sm text-slate-600">Aucun paiement traité.</p> : !recentError && recent?.map(r => <article key={r.id} className="rounded-2xl bg-white p-4">
        <div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold">{promoterLabel(r.promoteur_id)}</p><p className="mt-1 break-words text-sm text-slate-700">Pharmacie(s) : <span className="font-semibold">{pharmacyLabel(r.promoteur_id)}</span></p><p className="text-xs text-slate-500">{date(r.created_at)} · {r.identifiant_paiement ?? r.numero_recu ?? "—"}</p></div><strong>{money(r.montant)}</strong></div>
        <p className="mt-2 text-sm">{CANAUX[r.canal] ?? r.canal} · {r.statut === "confirme" ? "Confirmé" : "Contesté"} · Compte : {r.compte_payeur || "—"} · Paiement déclaré : {date(r.paye_le)}{r.periode_au ? " · Prochaine échéance " + r.periode_au : ""}{r.motif_contestation ? " · Motif : " + r.motif_contestation : ""}</p>
      </article>)}
    </section>
  </div></main>;
}
