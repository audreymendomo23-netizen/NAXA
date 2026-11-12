import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { ouvrirChatPharmacien, envoyerMessageChat } from "./actions";

type SearchParams = { ticket?: string; erreur?: string };
const field = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0A6B3A] focus:outline-none focus:ring-2 focus:ring-emerald-100";
const errors: Record<string, string> = {
  compte: "Connectez-vous avec un compte client pour démarrer une conversation.",
  message: "Choisissez une pharmacie et saisissez un message de 1 à 2 000 caractères.",
  pharmacie: "Cette pharmacie n’est plus disponible dans le répertoire.",
  envoi: "Le message n’a pas pu être envoyé. Vérifiez votre connexion puis réessayez.",
};

export default async function AidePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  const profileResult = auth.user
    ? await sb.from("profiles").select("id,role,pharmacie_id,actif").eq("id", auth.user.id).maybeSingle()
    : { data: null, error: null };
  const profile = profileResult.data;
  const isClient = profile?.role === "client" && profile.actif !== false;
  const isPharmacy = profile?.role === "pharmacie" && profile.actif !== false;

  const { data: pharmacies } = await sb.from("pharmacies")
    .select("id,nom,ville,quartier")
    .eq("actif", true).eq("visible_recherche", true).is("archivee_le", null)
    .order("ville").order("nom").limit(150);

  let tickets: { id: string; sujet: string; type: string; statut: string; pharmacie_id: string | null; created_at: string }[] = [];
  if (isClient && profile) {
    const { data } = await sb.from("tickets_support")
      .select("id,sujet,type,statut,pharmacie_id,created_at")
      .eq("auteur_profile_id", profile.id).eq("type", "conseil_pharmacien")
      .order("created_at", { ascending: false }).limit(20);
    tickets = (data ?? []) as typeof tickets;
  }

  const requestedTicket = typeof params.ticket === "string" ? params.ticket : "";
  const currentTicket = tickets.find((ticket) => ticket.id === requestedTicket) ?? tickets[0] ?? null;
  const messagesResult = currentTicket
    ? await sb.from("messages_support").select("id,ticket_id,auteur_profile_id,contenu,created_at")
      .eq("ticket_id", currentTicket.id).eq("interne", false).order("created_at", { ascending: true }).limit(100)
    : { data: [] };
  const messages = messagesResult.data ?? [];

  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900">
    <div className="mx-auto max-w-4xl space-y-5 pt-4 sm:pt-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-bold text-[#064B2A] hover:bg-emerald-50">← NAXA · Accueil</Link>
        <span className="rounded-full bg-[#064B2A] px-3 py-2 text-xs font-bold text-white">Aide NAXA</span>
      </header>

      <section className="overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-sm">
        <div className="bg-[#E6F7F6] p-6 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-800">Besoin d’aide ?</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#064B2A] sm:text-4xl">Parler gratuitement à une pharmacie</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">Envoyez une question écrite à une pharmacie du répertoire. Les réponses dépendent de la disponibilité de son équipe ; elles ne sont pas instantanées ni garanties 24 h/24.</p>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[0.85fr_1.15fr] sm:p-7">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <h2 className="font-extrabold text-[#064B2A]">Comment ça marche</h2>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-5 text-slate-700">
                <li>Choisissez une pharmacie disponible dans le répertoire.</li>
                <li>Écrivez votre question sans joindre de documents médicaux sensibles.</li>
                <li>Retrouvez la réponse dans cette conversation.</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <h2 className="font-extrabold text-red-900">Urgence médicale</h2>
              <p className="mt-2 text-sm leading-6 text-red-900">N’attendez pas une réponse dans ce chat. Contactez immédiatement les services d’urgence locaux ou rendez-vous au service d’urgence le plus proche.</p>
            </div>
            <p className="text-xs leading-5 text-slate-500">Ce canal d’information ne remplace pas un examen médical. NAXA ne fournit pas de diagnostic ni de posologie personnalisée dans cet espace.</p>
            {isPharmacy && <Link href="/pharmacie/aide" className="inline-flex min-h-11 items-center rounded-xl border border-emerald-200 px-4 font-bold text-[#064B2A]">Ouvrir la boîte de réception pharmacie</Link>}
          </aside>

          <section className="space-y-4">
            {params.erreur && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errors[params.erreur] ?? "Une erreur est survenue. Réessayez."}</p>}

            {!auth.user && <div className="rounded-2xl border border-emerald-100 p-4">
              <h2 className="font-extrabold">Connectez-vous pour discuter</h2>
              <p className="mt-1 text-sm text-slate-600">La connexion permet de retrouver votre conversation sans exposer vos messages.</p>
              <Link href="/connexion?retour=%2Faide" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#064B2A] px-4 font-bold text-white">Se connecter</Link>
            </div>}

            {auth.user && !isClient && !isPharmacy && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Cet espace de chat est réservé aux comptes clients et aux équipes de pharmacie.</p>}

            {isClient && <form action={ouvrirChatPharmacien} className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <h2 className="font-extrabold">Nouvelle conversation</h2>
              <label className="block text-sm font-semibold">Pharmacie
                <select name="pharmacie_id" required className={field} defaultValue="">
                  <option value="" disabled>Choisir une pharmacie</option>
                  {(pharmacies ?? []).map((pharmacy) => <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.nom} · {pharmacy.ville}{pharmacy.quartier ? " — " + pharmacy.quartier : ""}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">Votre question
                <textarea name="message" required minLength={1} maxLength={2000} rows={4} className={field} placeholder="Décrivez votre question en quelques lignes…" />
              </label>
              <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#064B2A] px-4 py-2 font-bold text-white hover:bg-[#0A6B3A]">Envoyer et ouvrir le chat</button>
              <p className="text-xs text-slate-500">Gratuit. N’envoyez pas de données de paiement, de pièce d’identité ni de photo d’ordonnance.</p>
            </form>}

            {isClient && currentTicket && <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-4">
                <div><h2 className="font-extrabold">Votre conversation</h2><p className="text-xs text-slate-500">Ouverte le {new Date(currentTicket.created_at).toLocaleString("fr-FR")}</p></div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">{currentTicket.statut === "ouvert" ? "En attente / en cours" : currentTicket.statut}</span>
              </div>
              <div className="max-h-[26rem] space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && <p className="text-sm text-slate-500">Votre question est envoyée. La réponse apparaîtra ici lorsqu’une personne de la pharmacie vous répondra.</p>}
                {messages.map((message: { id: number | string; auteur_profile_id: string | null; contenu: string; created_at: string }) => <div key={message.id} className={message.auteur_profile_id === profile?.id ? "ml-6 rounded-2xl rounded-br-sm bg-[#064B2A] p-3 text-sm leading-6 text-white" : "mr-6 rounded-2xl rounded-bl-sm bg-slate-100 p-3 text-sm leading-6 text-slate-800"}>
                  <p className="whitespace-pre-wrap break-words">{message.contenu}</p><p className="mt-1 text-right text-[10px] opacity-70">{new Date(message.created_at).toLocaleString("fr-FR")}</p>
                </div>)}
              </div>
              {currentTicket.statut === "ouvert" && <form action={envoyerMessageChat} className="flex flex-col gap-2 border-t border-slate-200 p-3 sm:flex-row">
                <input type="hidden" name="ticket_id" value={currentTicket.id} />
                <label className="sr-only" htmlFor="reply-message">Votre message</label>
                <textarea id="reply-message" name="message" required maxLength={2000} rows={2} className={field + " mt-0 flex-1"} placeholder="Écrire un message…" />
                <button type="submit" className="min-h-11 rounded-xl bg-[#064B2A] px-4 font-bold text-white">Envoyer</button>
              </form>}
              <div className="border-t border-slate-100 p-3 text-right"><Link href={"/aide?ticket=" + currentTicket.id} className="text-sm font-bold text-[#064B2A] underline">Actualiser la conversation</Link></div>
            </div>}

            {isClient && tickets.length > 1 && <div className="rounded-2xl border border-slate-200 p-4">
              <h2 className="font-extrabold">Vos autres conversations</h2>
              <ul className="mt-2 space-y-2">{tickets.filter((ticket) => ticket.id !== currentTicket?.id).map((ticket) => <li key={ticket.id}><Link className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold hover:bg-emerald-50" href={"/aide?ticket=" + ticket.id}><span>{new Date(ticket.created_at).toLocaleDateString("fr-FR")} · {ticket.sujet}</span><span>{ticket.statut}</span></Link></li>)}</ul>
            </div>}
          </section>
        </div>
      </section>
    </div>
  </main>;
}
