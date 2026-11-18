"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type SupportTicket = {
  id: string;
  reference_code: string;
  sujet: string;
  categorie: string;
  statut: string;
  created_at: string;
  last_activity_at: string;
};
type SupportMessage = {
  id: number;
  ticket_id: string;
  auteur_profile_id: string | null;
  contenu: string;
  interne: boolean;
  created_at: string;
  piece_jointe_path?: string | null;
  piece_jointe_nom?: string | null;
  piece_jointe_taille?: number | null;
  attachmentUrl?: string | null;
};

const MAX_MESSAGE_LENGTH = 2000;
const CATEGORIES = [
  ["compte", "Compte et connexion"], ["technique", "Problème technique"],
  ["gestion_espace", "Utilisation de mon espace"], ["personnel", "Personnel et affectations"],
  ["stock", "Stock et inventaires"], ["caisse", "Caisse et comptabilité"],
  ["commandes", "Commandes et réservations"], ["livraison", "Livraison et suivi"],
  ["abonnement_paiement", "Abonnement et paiement"], ["publication", "Catalogue et publications"],
  ["confidentialite", "Confidentialité"], ["signalement", "Signalement"],
  ["suggestion", "Suggestion"], ["autre", "Autre demande"],
] as const;
const STATUS: Record<string, string> = {
  ouvert: "Demande reçue",
  en_cours: "En cours",
  en_attente_client: "Réponse NAXA",
  resolu: "Résolue",
  ferme: "Clôturée",
};
const formatTime = (value: string) => new Date(value).toLocaleTimeString("fr-FR", { timeZone: "Africa/Douala", hour: "2-digit", minute: "2-digit" });
const formatDate = (value: string) => new Date(value).toLocaleDateString("fr-FR", { timeZone: "Africa/Douala", day: "2-digit", month: "short" });

export function NaxaSupportWidget({ hasBottomNav }: { hasBottomNav: boolean }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [accountId, setAccountId] = useState<string | null>(null);
  const authRevision = useRef(0);
  useEffect(() => {
    let active = true;
    const initialRevision = authRevision.current;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authRevision.current += 1;
      if (active) setAccountId(session?.user?.id ?? null);
    });
    void supabase.auth.getUser().then(({ data, error }) => {
      if (active && authRevision.current === initialRevision) {
        setAccountId(!error ? data.user?.id ?? null : null);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [supabase]);
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [newConversation, setNewConversation] = useState(false);
  const [category, setCategory] = useState("compte");
  const [subject, setSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [realtime, setRealtime] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const current = tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const isClosed = current?.statut === "ferme";
  const orderedMessages = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const refreshTickets = useCallback(async () => {
    setLoadingTickets(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("tickets_support")
      .select("id,reference_code,sujet,categorie,statut,created_at,last_activity_at")
      .eq("auteur_profile_id", accountId)
      .eq("type", "support_naxa")
      .order("last_activity_at", { ascending: false })
      .limit(20);

    if (queryError) {
      setError("Les conversations sont momentanément indisponibles.");
      setLoadingTickets(false);
      return;
    }
    const rows = (data ?? []) as SupportTicket[];
    setTickets(rows);
    setSelectedId((currentId) => {
      if (currentId && rows.some((ticket) => ticket.id === currentId)) return currentId;
      return rows.find((ticket) => ticket.statut !== "ferme")?.id ?? rows[0]?.id ?? "";
    });
    if (rows.length === 0) setNewConversation(true);
    else setNewConversation(false);
    setLoadingTickets(false);
  }, [accountId, supabase]);

  useEffect(() => {
    if (open) void refreshTickets();
  }, [open, refreshVersion, refreshTickets]);

  // Supabase Realtime ne doit pas conserver un canal devenu obsolète après une coupure réseau.
  // Recréer le canal à l’événement online relance l’abonnement et recharge l’historique.
  useEffect(() => {
    const handleOnline = () => setConnectionEpoch((version) => version + 1);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const hydrateMessage = useCallback(async (message: SupportMessage) => {
    if (!message.piece_jointe_path) return { ...message, attachmentUrl: null };
    const { data } = await supabase.storage.from("naxa-support-attachments")
      .createSignedUrl(message.piece_jointe_path, 600);
    return { ...message, attachmentUrl: data?.signedUrl ?? null };
  }, [supabase]);

  useEffect(() => {
    if (!open || !selectedId) {
      setMessages([]);
      setRealtime(false);
      return;
    }
    let active = true;
    const channel = supabase.channel("naxa-support-client-" + selectedId);

    async function loadMessages() {
      setLoadingMessages(true);
      const { data, error: queryError } = await supabase
        .from("messages_support")
        .select("id,ticket_id,auteur_profile_id,contenu,interne,created_at,piece_jointe_path,piece_jointe_nom,piece_jointe_taille")
        .eq("ticket_id", selectedId)
        .eq("interne", false)
        .order("created_at", { ascending: true })
        .limit(100);
      if (!active) return;
      if (queryError) {
        setError("L’historique de cette conversation est indisponible.");
        setLoadingMessages(false);
        return;
      }
      const hydrated = await Promise.all(((data ?? []) as SupportMessage[]).map(hydrateMessage));
      if (!active) return;
      setMessages(hydrated);
      setLoadingMessages(false);
    }
    channel
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages_support",
        filter: "ticket_id=eq." + selectedId,
      }, (payload) => {
        const row = payload.new as SupportMessage;
        if (row.interne) return;
        void hydrateMessage(row).then((hydrated) => {
          if (!active) return;
          setMessages((previous) => previous.some((message) => message.id === hydrated.id) ? previous : [...previous, hydrated]);
        });
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "tickets_support",
        filter: "id=eq." + selectedId,
      }, (payload) => {
        const updated = payload.new as Partial<SupportTicket>;
        if (!active) return;
        setTickets((previous) => previous.map((ticket) => ticket.id === selectedId ? { ...ticket, ...updated } : ticket));
      })
      .subscribe((status) => {
        if (active) setRealtime(status === "SUBSCRIBED");
      });

    void loadMessages();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [open, selectedId, supabase, hydrateMessage, connectionEpoch]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, loadingMessages]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function createConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const cleanSubject = subject.trim();
    const cleanMessage = firstMessage.trim();
    if (cleanSubject.length < 5 || cleanSubject.length > 100 || !cleanMessage || cleanMessage.length > 2000) {
      setError("Renseigne un sujet de 5 à 100 caractères et un message de 1 à 2 000 caractères.");
      return;
    }
    setSending(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("open_naxa_support_ticket", {
      p_categorie: category,
      p_sujet: cleanSubject,
      p_message: cleanMessage,
    });
    if (rpcError) {
      setError("La conversation n’a pas pu être ouverte. Réessaie dans un instant.");
      setSending(false);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const newId = row && typeof row === "object" && "ticket_id" in row ? String(row.ticket_id) : "";
    if (!/^[0-9a-f-]{36}$/i.test(newId)) {
      setError("La conversation a été créée, mais son numéro n’a pas pu être récupéré. Actualise le widget.");
      setSending(false);
      setRefreshVersion((version) => version + 1);
      return;
    }
    setSubject("");
    setFirstMessage("");
    setNewConversation(false);
    setSelectedId(newId);
    setSending(false);
    setRefreshVersion((version) => version + 1);
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = reply.trim();
    if (!accountId || !current || isClosed || !content || content.length > MAX_MESSAGE_LENGTH || sending) return;
    setSending(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("messages_support")
      .insert({ ticket_id: current.id, auteur_profile_id: accountId, contenu: content, interne: false })
      .select("id,ticket_id,auteur_profile_id,contenu,interne,created_at,piece_jointe_path,piece_jointe_nom,piece_jointe_taille")
      .single();
    if (insertError || !data) {
      setError("Le message n’a pas été envoyé. Vérifie ta connexion puis réessaie.");
      setSending(false);
      return;
    }
    const hydrated = await hydrateMessage(data as SupportMessage);
    setMessages((previous) => previous.some((message) => message.id === hydrated.id) ? previous : [...previous, hydrated]);
    setReply("");
    setSending(false);
    setRefreshVersion((version) => version + 1);
  }

  return (
    <>
      {open && (
        <section
          id="naxa-livechat-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Livechat avec l’équipe NAXA"
          className="fixed z-[82] flex h-[min(620px,calc(100dvh-110px))] min-h-0 w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-emerald-100 bg-white text-slate-900 shadow-[0_18px_60px_rgba(5,40,24,.28)]"
          style={{
            right: "max(12px, env(safe-area-inset-right, 0px))",
            bottom: hasBottomNav ? "calc(88px + env(safe-area-inset-bottom, 0px))" : "max(16px, env(safe-area-inset-bottom, 0px))",
          }}
          data-naxa-livechat
        >
          <header className="flex shrink-0 items-center gap-3 bg-[#064B2A] px-4 py-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFE23D] text-[#064B2A]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-extrabold">Assistance NAXA</h2>
              <p className="text-[11px] text-white/75">{realtime ? "Messages synchronisés en direct" : "Conversation et suivi de votre demande"}</p>
            </div>
            <Link href="/faq" onClick={() => setOpen(false)} aria-label="Consulter la FAQ NAXA" className="rounded-full border border-white/30 px-3 py-2 text-[10px] font-extrabold text-white hover:bg-white/10">FAQ</Link><button type="button" onClick={() => setOpen(false)} aria-label="Fermer le livechat" className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-white/80 hover:bg-white/10">×</button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col bg-[#F7FAF8]">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
              {tickets.length > 0 && (
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Choisir un dossier d’assistance</span>
                  <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setNewConversation(false); setError(""); }} className="min-h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700">
                    {tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.reference_code} · {ticket.sujet.slice(0, 32)}</option>)}
                  </select>
                </label>
              )}
              <button type="button" onClick={() => { setNewConversation(true); setError(""); }} className="min-h-9 shrink-0 rounded-lg bg-[#FFE23D] px-3 text-xs font-extrabold text-[#123D28] hover:bg-[#F5D82D]">+ Nouveau</button>
            </div>

            {error && <p role="alert" className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 p-2 text-xs leading-5 text-red-800">{error}</p>}

            {newConversation ? (
              <form onSubmit={createConversation} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#064B2A]">Parler à l’équipe NAXA</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Décris ton besoin. Ton message sera transmis directement à l’assistance NAXA, indépendamment de ton rôle ou de ta structure.</p>
                </div>
                <label className="text-xs font-bold text-slate-700">Catégorie
                  <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium">
                    {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">Sujet
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={5} maxLength={100} required className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium" placeholder="Ex. : Problème de connexion" />
                </label>
                <label className="flex min-h-0 flex-1 flex-col text-xs font-bold text-slate-700">Ton premier message
                  <textarea value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} required maxLength={MAX_MESSAGE_LENGTH} rows={5} className="mt-1 min-h-28 w-full flex-1 resize-none rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal" placeholder="Explique-nous ce qui se passe…" />
                </label>
                <p className="rounded-xl bg-amber-50 p-2 text-[11px] leading-4 text-amber-950">N’envoie jamais de mot de passe, code OTP, données bancaires ou document médical. Ce service ne traite pas les urgences médicales.</p>
                <button type="submit" disabled={sending || !subject.trim() || !firstMessage.trim()} className="min-h-11 rounded-xl bg-[#064B2A] px-4 text-sm font-extrabold text-white disabled:opacity-50">{sending ? "Envoi…" : "Démarrer la conversation"}</button>
                {tickets.length > 0 && <button type="button" onClick={() => setNewConversation(false)} className="min-h-9 text-xs font-bold text-[#064B2A] underline">Retour à mes conversations</button>}
              </form>
            ) : current ? (
              <>
                <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold text-slate-500">{current.reference_code} · {current.sujet}</p>
                    <p className="text-[11px] font-extrabold text-[#0B633A]">{STATUS[current.statut] ?? current.statut}</p>
                  </div>
                  <Link href={"/assistance?ticket=" + current.id} onClick={() => setOpen(false)} className="shrink-0 text-[11px] font-bold text-[#064B2A] underline">Détails</Link>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                  {loadingMessages && <p role="status" className="text-center text-xs text-slate-500">Chargement des messages…</p>}
                  {loadingTickets && <p role="status" className="text-center text-xs text-slate-500">Chargement de tes demandes…</p>}
                  {!loadingMessages && orderedMessages.length === 0 && <p className="rounded-xl bg-white p-3 text-xs text-slate-600">La conversation est ouverte. Écris ton premier message à l’équipe NAXA.</p>}
                  {orderedMessages.map((message) => (
                    <article key={message.id} className={"max-w-[88%] rounded-2xl p-3 shadow-sm " + (message.auteur_profile_id === accountId ? "ml-auto rounded-br-sm bg-[#064B2A] text-white" : "mr-auto rounded-bl-sm border border-slate-100 bg-white text-slate-800")}>
                      <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide opacity-65">{message.auteur_profile_id === accountId ? "Vous" : "Équipe NAXA"}</p>
                      <p className="whitespace-pre-wrap break-words text-xs leading-5">{message.contenu}</p>
                      {message.piece_jointe_nom && <div className="mt-2 rounded-lg bg-black/5 p-2 text-[11px]">
                        {message.attachmentUrl ? <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">Ouvrir : {message.piece_jointe_nom}</a> : <span>Fichier : {message.piece_jointe_nom}</span>}
                        {message.piece_jointe_taille ? <span className="ml-2 opacity-70">{Math.ceil(message.piece_jointe_taille / 1024)} Ko</span> : null}
                      </div>}
                      <time className="mt-1 block text-right text-[9px] opacity-60">{formatDate(message.created_at)} · {formatTime(message.created_at)}</time>
                    </article>
                  ))}
                  <div ref={bottomRef}/>
                </div>
                {isClosed ? (
                  <div className="shrink-0 border-t border-slate-200 bg-white p-3">
                    <p className="text-center text-xs text-slate-600">Cette conversation est clôturée.</p>
                    <button type="button" onClick={() => setNewConversation(true)} className="mt-2 min-h-10 w-full rounded-xl bg-[#FFE23D] px-3 text-xs font-extrabold text-[#123D28]">Ouvrir une nouvelle demande</button>
                  </div>
                ) : (
                  <form onSubmit={sendReply} className="flex shrink-0 items-end gap-2 border-t border-slate-200 bg-white p-3">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Votre message</span>
                      <textarea
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        maxLength={MAX_MESSAGE_LENGTH}
                        rows={1}
                        className="max-h-24 min-h-10 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-emerald-700"
                        placeholder="Écrire un message…"
                      />
                    </label>
                    <button type="submit" disabled={sending || !reply.trim()} aria-label="Envoyer le message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFE23D] text-[#123D28] disabled:opacity-50">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF5B8] text-2xl text-[#064B2A]">✉</span>
                <h3 className="font-extrabold text-[#064B2A]">Besoin d’aide ? Parlons-en.</h3>
                <p className="text-xs leading-5 text-slate-600">Écris directement à l’équipe NAXA. Ton échange reste personnel et indépendant de ton Responsable.</p>
                <button type="button" onClick={() => setNewConversation(true)} className="min-h-11 w-full rounded-xl bg-[#FFE23D] px-4 text-sm font-extrabold text-[#123D28]">Écrire à NAXA</button>
                <Link href="/faq" onClick={() => setOpen(false)} className="text-xs font-bold text-[#064B2A] underline">Consulter la FAQ</Link>
              </div>
            )}
            <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500">
              <span>{realtime ? "● Temps réel actif" : "Messages synchronisés à l’ouverture"}</span>
              <Link href="/assistance" onClick={() => setOpen(false)} className="font-bold text-[#064B2A] underline">Mes dossiers</Link>
            </footer>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); }}
        aria-label={open ? "Assistance NAXA ouverte" : "Ouvrir le livechat NAXA"}
        aria-expanded={open}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        aria-controls="naxa-livechat-panel"
        title="Parler à l’équipe NAXA"
        className={"fixed z-[83] flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-[#FFE23D] text-[#064B2A] shadow-[0_8px_28px_rgba(6,75,42,.28)] transition-transform duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0B633A] active:scale-95 " + (open ? "pointer-events-none scale-0 opacity-0" : "")}
        style={{
          right: "max(14px, env(safe-area-inset-right, 0px))",
          bottom: hasBottomNav ? "calc(16px + 64px + env(safe-area-inset-bottom, 0px) + 8px)" : "max(16px, env(safe-area-inset-bottom, 0px))",
        }}
        data-naxa-livechat-trigger
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/></svg>
        )}

      </button>
    </>
  );
}
