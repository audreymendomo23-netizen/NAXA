"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SupportAudioCall } from "@/components/support/SupportAudioCall";

type Message = {
  id: number;
  contenu: string;
  interne: boolean;
  created_at: string;
  authorLabel: string;
  attachmentUrl: string | null;
  piece_jointe_nom: string | null;
};

type Ticket = {
  id: string;
  reference_code: string | null;
  sujet: string;
  categorie: string | null;
  statut: string;
  created_at: string;
};

export function SupportAgentTicket({ ticketId, callId = null }: { ticketId: string; callId?: string | null }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [internal, setInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [threadResponse, sessionResponse] = await Promise.all([
        fetch("/api/support-agent/ticket?ticket_id=" + encodeURIComponent(ticketId), { cache: "no-store" }),
        fetch("/api/support-agent/session", { cache: "no-store" }),
      ]);
      const thread = await threadResponse.json();
      const session = await sessionResponse.json();
      if (!threadResponse.ok) throw new Error(thread.error || "Dossier indisponible.");
      if (!sessionResponse.ok) throw new Error(session.error || "Session Agent indisponible.");
      setTicket(thread.ticket);
      setMessages(thread.messages ?? []);
      setPermissions(session.permissions ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dossier indisponible.");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!ticketId) return;
    let active = true;
    const channel = supabase.channel("naxa-support-agent-" + ticketId)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages_support",
        filter: "ticket_id=eq." + ticketId,
      }, () => {
        if (active) void refresh();
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "tickets_support",
        filter: "id=eq." + ticketId,
      }, () => {
        if (active) void refresh();
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [ticketId, supabase, refresh]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/support-agent/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId, contenu: content.trim(), interne: internal }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Le message n’a pas été envoyé.");
      setContent("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le message n’a pas été envoyé.");
    } finally {
      setSending(false);
    }
  }

  const closed = ticket?.statut === "resolu" || ticket?.statut === "ferme";
  const canSend = internal
    ? permissions.includes("ticket_internal_note")
    : permissions.includes("ticket_reply");

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <a href="/equipe-support" className="text-sm font-semibold text-emerald-800">← Retour au tableau de bord</a>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading && <p role="status" className="text-sm text-slate-500">Chargement du dossier…</p>}
      {ticket && <>
        <header className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="font-mono text-xs font-bold text-emerald-800">{ticket.reference_code}</p>
          <h1 className="mt-1 text-xl font-black">{ticket.sujet}</h1>
          <p className="mt-2 text-sm text-slate-500">{ticket.categorie || "Autre"} · {ticket.statut}</p>
        </header>

        {callId && permissions.includes("audio_call") && permissions.includes("ticket_view_assigned") && <SupportAudioCall ticketId={ticketId} mode="agent" initialCallId={callId} />}

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-extrabold">Conversation</h2>
          {!messages.length && <p className="text-sm text-slate-500">Aucun message dans ce dossier.</p>}
          {messages.map((message) => (
            <article key={message.id} className={"rounded-xl p-3 " + (message.interne ? "border border-amber-200 bg-amber-50" : "bg-slate-50")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm">{message.authorLabel}</strong>
                <span className="text-xs text-slate-500">{new Date(message.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}</span>
              </div>
              {message.interne && <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-amber-800">Note interne — non visible par le demandeur</p>}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.contenu}</p>
              {message.attachmentUrl && <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline">{message.piece_jointe_nom || "Ouvrir la pièce jointe"}</a>}
            </article>
          ))}
        </section>

        <form onSubmit={send} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-extrabold">Répondre au demandeur</h2>
          {permissions.includes("ticket_internal_note") && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
            Ajouter une note interne (invisible au demandeur)
          </label>}
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={internal ? "Note réservée à l’équipe NAXA…" : "Votre réponse au demandeur…"}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-emerald-700"
            disabled={closed || !canSend || sending}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{content.length}/2000 caractères</span>
            <button type="submit" disabled={closed || !canSend || !content.trim() || sending} className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
              {sending ? "Envoi…" : internal ? "Enregistrer la note" : "Envoyer la réponse"}
            </button>
          </div>
          {closed && <p className="text-sm text-slate-500">Ce dossier est résolu ou clôturé et ne peut plus recevoir de message.</p>}
          {!canSend && !closed && <p className="text-sm text-amber-700">Votre compte ne dispose pas de la permission nécessaire pour cette action.</p>}
        </form>
      </>}
    </div>
  );
}
