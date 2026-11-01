import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { supabaseAdmin } from "@/lib/supabase/server";
import { confirmerReglementPromoteur, contesterReglementPromoteur } from "./actions";

type SearchParams = { ok?: string; erreur?: string };
const CANAUX: Record<string, string> = {
  especes: "Espèces", orange_money: "Orange Money", mtn_momo: "MTN Mobile Money",
  virement: "Virement bancaire", depot_bancaire: "Dépôt bancaire", autre: "Autre",
};
const money = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const date = (s: string | null) => s ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Douala" }).format(new Date(s)) : "—";

export default async function ReglementsAdminPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdminActive("/admin/pilotage/reglements");
  const db = supabaseAdmin();
  const [{ data: pending, error: pendingError }, { data: recent, error: recentError }] = await Promise.all([
    db.from("abonnement_promoteur_reglements").select("id,promoteur_id,montant,canal,canal_autre,compte_payeur,reference,paye_le,preuve_path,created_at").eq("statut", "en_attente").order("created_at", { ascending: true }).limit(100),
    db.from("abonnement_promoteur_reglements").select("id,promoteur_id,montant,canal,canal_autre,compte_payeur,reference,paye_le,statut,numero_recu,identifiant_paiement,periode_au,created_at,motif_contestation").neq("statut", "en_attente").order("created_at", { ascending: false }).limit(50),
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
  await Promise.all((pending ?? []).map(async r => {
    const { data } = await db.storage.from("preuves-reglements-promoteurs").createSignedUrl(r.preuve_path, 600);
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
      <Link href="/admin/pilotage/validite" className="mt-3 inline-block text-sm font-bold underline">Retour à la validité</Link>
    </header>
    {searchParams?.ok && <p role="status" className="rounded-2xl bg-white p-4 text-green-800">{searchParams.ok === "confirme" ? "Paiement confirmé, abonnement renouvelé et reçu disponible dans l’espace Promoteur." : "Règlement mis à jour."}</p>}
    {searchParams?.erreur && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">{errors[searchParams.erreur] ?? "Une erreur est survenue."}</p>}
    {paymentContextUnavailable && <p role="alert" className="rounded-2xl border border-amber-300 bg-white p-4 text-sm text-amber-900">L’identité du Promoteur ou la liste de ses pharmacies rattachées est incomplète. La confirmation est désactivée jusqu’à ce que le dossier soit entièrement vérifiable.</p>}
    <section className="space-y-3">
      <h2 className="text-xl font-black">Paiements à vérifier ({pending?.length ?? 0})</h2>
      {pendingError && <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">Impossible de charger les paiements à vérifier.</p>}
      {!pendingError && !pending?.length && <p className="rounded-2xl bg-white p-4 text-sm text-slate-600">Aucun paiement en attente de vérification.</p>}
      {(pending ?? []).map(r => {
        const proof = proofLinks.get(r.id);
        const isVideo = /\.(mp4|webm|mov)$/i.test(r.preuve_path);
        return <article key={r.id} className="rounded-3xl bg-white p-4 sm:p-5">
          <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-extrabold">{promoterLabel(r.promoteur_id)}</h3><p className="mt-1 break-words text-sm text-slate-700">Pharmacie(s) : <span className="font-semibold">{pharmacyLabel(r.promoteur_id)}</span></p><p className="text-xs text-slate-500">Soumis le {date(r.created_at)}</p></div><strong className="text-lg">{money(r.montant)}</strong></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-slate-500">Canal de paiement</dt><dd className="font-semibold">{CANAUX[r.canal] ?? r.canal}{r.canal_autre ? " · " + r.canal_autre : ""}</dd></div>
            <div><dt className="text-slate-500">Compte / numéro payeur</dt><dd className="font-semibold">{r.compte_payeur || "—"}</dd></div>
            <div><dt className="text-slate-500">Référence de transaction</dt><dd className="font-semibold">{r.reference || "Non renseignée"}</dd></div>
            <div><dt className="text-slate-500">Date de paiement déclarée</dt><dd className="font-semibold">{date(r.paye_le)}</dd></div>
          </dl>
          {proof && <div className="mt-4 rounded-2xl border border-slate-200 p-3">
            {isVideo && <video controls preload="metadata" className="mb-3 max-h-80 w-full rounded-xl bg-black" src={proof}>Votre navigateur ne peut pas lire cette vidéo.</video>}
            {!isVideo && /\.(jpg|jpeg|png|webp)$/i.test(r.preuve_path) && <a href={proof} target="_blank" rel="noreferrer"><img src={proof} alt="Preuve du paiement envoyée par le Promoteur" className="mb-3 max-h-80 max-w-full rounded-xl object-contain" /></a>}
            <a className="inline-block rounded-full border border-[#0147BB] px-4 py-2 text-sm font-bold text-[#0147BB] underline" href={proof} target="_blank" rel="noreferrer" download>Consulter / télécharger la preuve privée</a>
            <p className="mt-2 text-xs text-slate-500">Lien privé temporaire, valable 10 minutes. Renouvelez la page si nécessaire.</p>
          </div>}
          {!proof && <p className="mt-3 text-sm text-red-700">La preuve n’a pas pu être chargée. Ne confirmez pas le paiement sans l’avoir vérifiée.</p>}
          <form action={confirmerReglementPromoteur} className="mt-4"><input type="hidden" name="reglement_id" value={r.id}/><label className="mb-3 flex items-start gap-2 text-sm"><input required type="checkbox" name="preuve_verifiee" className="mt-1 h-4 w-4 accent-[#0F6B3F]"/><span>J’ai consulté la preuve et vérifié les références ainsi que la réalité de l’encaissement auprès du canal concerné.</span></label><button disabled={!proof || paymentContextUnavailable} className="min-h-11 rounded-full bg-[#0F6B3F] px-5 font-bold text-white disabled:opacity-40">Confirmer l’encaissement réel et renouveler l’abonnement</button><p className="mt-2 text-xs text-slate-500">Cette action est définitive et journalisée. Elle met à jour l’échéance à partir de la date de validation.</p></form>
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
