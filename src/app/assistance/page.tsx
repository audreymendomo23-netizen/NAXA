import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { creerDemandeNaxa, envoyerReponseNaxa } from "./actions";

export const metadata = {
  title: "Assistance NAXA — Écrire à notre équipe",
  description: "Contactez directement l’équipe NAXA et suivez vos demandes d’assistance.",
};

type SearchParams = {
  ticket?: string;
  erreur?: string;
  envoye?: string;
  avertissement?: string;
};

const categories = [
  ["compte", "Compte et connexion"], ["technique", "Problème technique"],
  ["gestion_espace", "Utilisation de mon espace"], ["personnel", "Personnel et affectations"],
  ["stock", "Stock et inventaires"], ["caisse", "Caisse et comptabilité"],
  ["commandes", "Commandes et réservations"], ["livraison", "Livraison et suivi"],
  ["abonnement_paiement", "Abonnement et paiement"], ["publication", "Catalogue et publications"],
  ["confidentialite", "Confidentialité et données personnelles"], ["signalement", "Signalement"],
  ["suggestion", "Suggestion ou amélioration"], ["autre", "Autre demande"],
] as const;

const statuses: Record<string, { label: string; tone: string }> = {
  ouvert: { label: "Demande reçue", tone: "bg-blue-50 text-blue-800" },
  en_cours: { label: "En cours de traitement", tone: "bg-amber-50 text-amber-900" },
  en_attente_client: { label: "Réponse NAXA disponible", tone: "bg-emerald-50 text-emerald-900" },
  resolu: { label: "Marquée comme résolue", tone: "bg-slate-100 text-slate-700" },
  ferme: { label: "Demande clôturée", tone: "bg-slate-200 text-slate-700" },
};

const input = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0A6B3A] focus:outline-none focus:ring-2 focus:ring-emerald-100";

const errors: Record<string, string> = {
  formulaire: "Vérifie le sujet, la catégorie et le message.",
  envoi: "La demande n’a pas pu être envoyée. Réessaie ; aucun message n’a été confirmé.",
  ticket: "Cette demande est introuvable ou déjà clôturée.",
  piece_jointe: "Le fichier doit être un PDF, JPG, PNG ou WebP de 4 Mo maximum.",
};

export default async function AssistanceNaxaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sb = supabaseServer();
  const { data: auth, error: authError } = await sb.auth.getUser();

  if (authError || !auth.user) {
    redirect("/connexion?retour=%2Fassistance");
  }

  const [{ data: profile, error: profileError }, { data: activeRole, error: activeRoleError }] = await Promise.all([
    sb.from("profiles").select("id,role,actif,first_name").eq("id", auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
  ]);

  if (profileError || activeRoleError || !profile || profile.actif !== true
    || profile.role === "admin" || !activeRole || activeRole === "admin") redirect("/");
  const isClient = activeRole === "client";

  const { data: tickets, error: ticketsError } = await sb.from("tickets_support")
    .select("id,reference_code,sujet,categorie,statut,created_at,last_activity_at,first_response_at,resolved_at")
    .eq("auteur_profile_id", profile.id)
    .eq("type", "support_naxa")
    .order("last_activity_at", { ascending: false })
    .limit(20);

  const ticketList = tickets ?? [];
  const current = ticketList.find((ticket) => ticket.id === params.ticket) ?? ticketList[0] ?? null;

  const messagesResult = current
    ? await sb.from("messages_support")
      .select("id,ticket_id,auteur_profile_id,contenu,created_at,piece_jointe_path,piece_jointe_nom,piece_jointe_mime,piece_jointe_taille")
      .eq("ticket_id", current.id)
      .eq("interne", false)
      .order("created_at", { ascending: true })
      .limit(100)
    : { data: [], error: null };

  const messages = await Promise.all((messagesResult.data ?? []).map(async (message) => {
    if (!message.piece_jointe_path) return { ...message, attachmentUrl: null };
    const { data } = await sb.storage.from("naxa-support-attachments")
      .createSignedUrl(message.piece_jointe_path, 600);
    return { ...message, attachmentUrl: data?.signedUrl ?? null };
  }));

  const status = current ? (statuses[current.statut] ?? statuses.ouvert) : null;
  const formatter = (value: string) => new Date(value).toLocaleString("fr-FR", { timeZone: "Africa/Douala" });

  return (
    <main className="min-h-screen bg-[#F7FAF8] px-4 pb-14 pt-4 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/faq" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-[#064B2A] hover:bg-emerald-50">← Centre d’aide</Link>
          <span className="rounded-full bg-[#064B2A] px-3 py-2 text-xs font-bold text-white">Assistance NAXA</span>
        </header>

        <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
          <div className="bg-[#064B2A] p-6 text-white sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#FFE23D]">Assistance directe</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Écrire à l’équipe NAXA</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
              Client ou professionnel : décris ton besoin, quel que soit ton rôle ou ton écosystème. Ton dossier est personnel et n’est pas transmis à ton Responsable.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-white/10 px-3 py-2">Échange confidentiel</span>
              <span className="rounded-full bg-white/10 px-3 py-2">Numéro de dossier</span>
              <span className="rounded-full bg-white/10 px-3 py-2">Historique conservé</span>
            </div>
          </div>

          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold text-[#064B2A]">Nouvelle demande</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">Décris le problème avec le plus de précision possible. L’équipe NAXA te répondra dans ce dossier.</p>
              </div>

              {params.erreur && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errors[params.erreur] ?? "Une erreur est survenue. Réessaie."}</p>}
              {params.envoye === "1" && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Ton message a été enregistré. Tu peux suivre la réponse dans ton dossier.</p>}
              {params.avertissement === "piece_jointe" && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Ton message texte a été envoyé, mais la pièce jointe n’a pas pu être ajoutée. Tu peux la renvoyer dans une réponse.</p>}

              <form action={creerDemandeNaxa} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <label className="block text-sm font-semibold">Catégorie
                  <select name="categorie" required defaultValue="compte" className={input}>
                    {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold">Sujet
                  <input name="sujet" required minLength={5} maxLength={100} className={input} placeholder="Ex. : Je n’arrive plus à accéder à mon compte" />
                </label>
                <label className="block text-sm font-semibold">Ton message
                  <textarea name="message" required minLength={1} maxLength={2000} rows={5} className={input} placeholder="Explique ce qui se passe, ce que tu faisais et ce que tu attendais…" />
                </label>
                <label className="block text-sm font-semibold">Capture d’écran ou document (facultatif)
                  <input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-bold file:text-emerald-900" />
                  <span className="mt-1 block text-xs font-normal text-slate-500">Un seul fichier · PDF, JPG, PNG ou WebP · 4 Mo maximum.</span>
                </label>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <strong>Protège tes informations :</strong> ne joins jamais de mot de passe, code OTP, coordonnées bancaires, pièce d’identité, ordonnance ou document médical. Pour une urgence médicale, contacte directement les services d’urgence.
                </div>
                <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#064B2A] px-4 py-3 font-extrabold text-white hover:bg-[#0A6B3A]">Envoyer ma demande à NAXA</button>
                <p className="text-center text-xs text-slate-500">L’envoi est gratuit. Le délai de réponse peut varier selon le sujet et la disponibilité de l’équipe.</p>
              </form>

              {isClient && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-bold text-slate-800">Une question sur un produit ou un stock ?</h3>
                <p className="mt-1 text-sm text-slate-600">Pour une disponibilité, un prix ou une offre propre à une pharmacie, écris directement à l’établissement.</p>
                <Link href="/aide" className="mt-3 inline-flex min-h-10 items-center font-bold text-[#064B2A] underline">Parler à une pharmacie →</Link>
              </div>}
            </section>

            <section className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div><h2 className="text-xl font-extrabold text-[#064B2A]">Mes demandes</h2><p className="mt-1 text-sm text-slate-600">{ticketList.length} dossier(s) récent(s) · maximum 20 affichés</p></div>
                {current && <Link href={"/assistance?ticket=" + current.id} className="text-sm font-bold text-[#064B2A] underline">Actualiser</Link>}
              </div>

              {ticketsError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">L’historique des demandes est momentanément indisponible.</p>}

              {ticketList.length > 0 && <div className="flex gap-2 overflow-x-auto pb-2">
                {ticketList.map((ticket) => {
                  const ticketStatus = statuses[ticket.statut] ?? statuses.ouvert;
                  return <Link key={ticket.id} href={"/assistance?ticket=" + ticket.id} className={"min-w-52 max-w-64 rounded-xl border p-3 text-left " + (ticket.id === current?.id ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white")}>
                    <span className="block font-mono text-xs font-bold text-slate-500">{ticket.reference_code}</span>
                    <strong className="mt-1 block line-clamp-2 text-sm">{ticket.sujet}</strong>
                    <span className={"mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold " + ticketStatus.tone}>{ticketStatus.label}</span>
                  </Link>;
                })}
              </div>}

              {!current ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <span className="text-3xl" aria-hidden="true">✉</span>
                  <h3 className="mt-3 font-extrabold">Aucune demande pour le moment</h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-600">Quand tu écriras à NAXA, ton dossier et son numéro de suivi apparaîtront ici.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4">
                    <div><p className="font-mono text-xs font-bold text-[#064B2A]">{current.reference_code}</p><h3 className="mt-1 font-extrabold">{current.sujet}</h3><p className="mt-1 text-xs text-slate-500">Ouverte le {formatter(current.created_at)}</p></div>
                    <span className={"rounded-full px-3 py-2 text-xs font-bold " + status?.tone}>{status?.label}</span>
                  </div>
                  <div className="max-h-[34rem] space-y-3 overflow-y-auto p-4">
                    {messages.length === 0 && <p className="text-sm text-slate-500">Aucun message n’est encore visible dans ce dossier.</p>}
                    {messages.map((message) => <article key={message.id} className={"max-w-[92%] rounded-2xl p-3 " + (message.auteur_profile_id === profile.id ? "ml-auto rounded-br-sm bg-[#064B2A] text-white" : "mr-auto rounded-bl-sm bg-slate-100 text-slate-800")}>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">{message.auteur_profile_id === profile.id ? "Moi" : "Équipe NAXA"}</p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.contenu}</p>
                      {message.piece_jointe_path && <div className="mt-2 rounded-lg bg-black/5 p-2 text-xs">
                        {message.attachmentUrl
                          ? <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">Ouvrir : {message.piece_jointe_nom}</a>
                          : <span>Pièce jointe temporairement indisponible : {message.piece_jointe_nom}</span>}
                        <span className="mt-1 block opacity-70">{Math.max(1, Math.round((message.piece_jointe_taille ?? 0) / 1024))} Ko</span>
                      </div>}
                      <p className="mt-2 text-right text-[10px] opacity-60">{formatter(message.created_at)}</p>
                    </article>)}
                  </div>
                  {current.statut !== "ferme" ? (
                    <form action={envoyerReponseNaxa} className="space-y-3 border-t border-slate-200 p-4">
                      <input type="hidden" name="ticket_id" value={current.id} />
                      <label className="block text-sm font-semibold">Répondre à l’équipe NAXA
                        <textarea name="message" required maxLength={2000} rows={3} className={input} placeholder="Ajouter une précision ou répondre à la demande de l’équipe…" />
                      </label>
                      <label className="block text-sm font-semibold">Joindre un fichier (facultatif)
                        <input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm" />
                      </label>
                      <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#064B2A] px-4 font-bold text-white">Envoyer ma réponse</button>
                    </form>
                  ) : <p className="border-t border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Ce dossier est clôturé. Pour un nouveau besoin, crée une nouvelle demande.</p>}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
