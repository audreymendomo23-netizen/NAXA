"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Message = {
  id: string | number;
  ticket_id: string;
  auteur_profile_id: string | null;
  contenu: string;
  interne: boolean;
  created_at: string;
  piece_jointe_path?: string | null;
  piece_jointe_nom?: string | null;
  piece_jointe_mime?: string | null;
  piece_jointe_taille?: number | null;
  attachmentUrl?: string | null;
};
type Ticket = {
  id: string;
  auteur_profile_id: string | null;
  pharmacie_id: string | null;
  sujet: string;
  type: string;
  statut: string;
  created_at: string;
  reference_code?: string | null;
  categorie?: string | null;
  last_activity_at?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  ouvert: "Reçue",
  en_cours: "En cours",
  en_attente_client: "Réponse NAXA",
  resolu: "Résolue",
  ferme: "Clôturée",
};

const CATEGORY_LABELS: Record<string, string> = {
  compte: "Compte et connexion",
  technique: "Problème technique",
  commande: "Commande, réservation ou livraison",
  signalement: "Signalement",
  confidentialite: "Confidentialité",
  suggestion: "Suggestion",
  autre: "Autre",
};

export function AdminInbox({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(tickets[0]?.id ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [threadRevision, setThreadRevision] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [statusSaving, setStatusSaving] = useState(false);
  const current = tickets.find((ticket) => ticket.id === selected);
  const currentStatus = current ? (statusOverrides[current.id] ?? current.statut) : "";
  const thread = messages.filter((message) => message.ticket_id === selected)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const canReply = Boolean(current && (
    current.type === "support_naxa" ? currentStatus !== "ferme" :
      currentStatus === "ouvert"
  ));

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase.channel("naxa-admin-support-inbox")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "tickets_support",
        filter: "type=eq.support_naxa",
      }, () => router.refresh())
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "tickets_support",
        filter: "type=eq.support_naxa",
      }, () => router.refresh())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [router]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      setThreadLoading(false);
      setThreadError("");
      return;
    }

    const controller = new AbortController();
    const supabase = supabaseBrowser();
    setMessages([]);
    setThreadLoading(true);
    setThreadError("");

    const channel = supabase.channel("naxa-admin-ticket-" + selected)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages_support",
        filter: "ticket_id=eq." + selected,
      }, (payload) => {
        const message = payload.new as Message;
        setMessages((previous) => previous.some((item) => item.id === message.id)
          ? previous
          : [...previous, message]);
        if (message.piece_jointe_path) setThreadRevision((revision) => revision + 1);
      })
      .subscribe();

    void fetch("/api/admin/messagerie?ticket_id=" + encodeURIComponent(selected), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof result.error === "string" ? result.error : "L’historique de ce ticket est indisponible.");
        }
        if (!Array.isArray(result.messages)) {
          throw new Error("La réponse du serveur ne contient pas un historique valide.");
        }
        if (!controller.signal.aborted) setMessages(result.messages as Message[]);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setThreadError(cause instanceof Error ? cause.message : "L’historique de ce ticket est indisponible.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setThreadLoading(false);
      });

    return () => {
      controller.abort();
      void supabase.removeChannel(channel);
    };
  }, [selected, threadRevision]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current || !reply.trim() || sending || !canReply) return;
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/messagerie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: current.id, contenu: reply.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "La réponse n’a pas été envoyée. Réessayez.");
        return;
      }
      setReply("");
      setSuccess("Réponse envoyée au Client.");
      if (current.type === "support_naxa") {
        setStatusOverrides((old) => ({ ...old, [current.id]: "en_attente_client" }));
      }
      setThreadRevision((revision) => revision + 1);
    } catch {
      setError("La messagerie est momentanément indisponible.");
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(nextStatus: string) {
    if (!current || current.type !== "support_naxa" || statusSaving || currentStatus === nextStatus) return;
    setStatusSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/messagerie", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: current.id, statut: nextStatus }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "Le statut n’a pas été modifié.");
        return;
      }
      setStatusOverrides((old) => ({ ...old, [current.id]: nextStatus }));
      setSuccess("Statut mis à jour : " + (STATUS_LABELS[nextStatus] ?? nextStatus) + ".");
    } catch {
      setError("La messagerie est momentanément indisponible.");
    } finally {
      setStatusSaving(false);
    }
  }

  return <div className="grid gap-4 lg:grid-cols-[minmax(250px,.8fr)_minmax(0,1.4fr)]">
    <section className="carte space-y-3"><div><h2 className="text-lg font-extrabold">Requêtes reçues</h2><p className="text-sm text-slate-500">{tickets.length} ticket(s) récents</p></div>
      {!tickets.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune requête support n’est enregistrée.</p>}
      {tickets.map((ticket) => {
        const status = statusOverrides[ticket.id] ?? ticket.statut;
        return <button key={ticket.id} type="button" onClick={() => { setSelected(ticket.id); setError(""); setSuccess(""); }} className={"block w-full rounded-xl border p-3 text-left " + (selected === ticket.id ? "border-emerald-800 bg-emerald-50" : "border-slate-200 bg-white")}>
          <span className="flex items-start justify-between gap-2"><strong className="break-words">{ticket.sujet}</strong><span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold">{STATUS_LABELS[status] ?? status}</span></span>
          {ticket.type === "support_naxa" && <span className="mt-1 block font-mono text-xs font-bold text-emerald-800">{ticket.reference_code}</span>}
          <span className="mt-1 block text-xs text-slate-500">{ticket.type === "support_naxa" ? (CATEGORY_LABELS[ticket.categorie ?? "autre"] ?? ticket.categorie) : ticket.type} · {new Date(ticket.last_activity_at ?? ticket.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}</span>
          <span className="mt-1 block truncate font-mono text-[10px] text-slate-400">{ticket.id}</span>
        </button>;
      })}
    </section>
    <section className="carte space-y-4">
      {!current ? <p className="text-sm text-slate-600">Sélectionnez une requête pour lire et traiter le fil.</p> : <>
        <header><div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">{current.type === "support_naxa" ? "Assistance Client → NAXA" : "Fil de support"}</p><h2 className="text-xl font-extrabold">{current.sujet}</h2><p className="text-xs text-slate-500">{current.type === "support_naxa" ? (current.reference_code + " · " + (CATEGORY_LABELS[current.categorie ?? "autre"] ?? current.categorie)) : current.type + " · " + (current.pharmacie_id ? "Pharmacie liée" : "Aucune pharmacie liée")}</p></div></header>
        {current.type === "support_naxa" && <div className="flex flex-wrap gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <span className="mr-auto self-center text-sm font-bold text-emerald-950">Statut : {STATUS_LABELS[currentStatus] ?? currentStatus}</span>
          {currentStatus === "ouvert" && <button type="button" disabled={statusSaving} onClick={() => void changeStatus("en_cours")} className="min-h-10 rounded-lg bg-white px-3 text-xs font-bold text-emerald-900 disabled:opacity-50">Prendre en charge</button>}
          {(currentStatus === "ouvert" || currentStatus === "en_cours") && <button type="button" disabled={statusSaving} onClick={() => void changeStatus("en_attente_client")} className="min-h-10 rounded-lg bg-white px-3 text-xs font-bold text-emerald-900 disabled:opacity-50">Attendre le Client</button>}
          {currentStatus !== "resolu" && currentStatus !== "ferme" && <button type="button" disabled={statusSaving} onClick={() => void changeStatus("resolu")} className="min-h-10 rounded-lg bg-white px-3 text-xs font-bold text-emerald-900 disabled:opacity-50">Marquer résolue</button>}
          {currentStatus !== "ferme" && <button type="button" disabled={statusSaving} onClick={() => void changeStatus("ferme")} className="min-h-10 rounded-lg bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50">Clôturer</button>}
          {(currentStatus === "resolu" || currentStatus === "ferme") && <button type="button" disabled={statusSaving} onClick={() => void changeStatus("en_cours")} className="min-h-10 rounded-lg bg-white px-3 text-xs font-bold text-emerald-900 disabled:opacity-50">Réouvrir</button>}
        </div>}
        <div className="max-h-[48vh] space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
          {threadLoading && <p role="status" className="text-sm text-slate-500">Chargement de l’historique…</p>}
          {threadError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{threadError}</p>}
          {!threadLoading && !threadError && !thread.length && <p className="text-sm text-slate-500">Aucun message dans ce ticket.</p>}
          {!threadError && thread.map((message) => <article key={message.id} className="rounded-xl border bg-white p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="text-xs">{message.auteur_profile_id === current.auteur_profile_id ? "Client / demandeur" : current.type === "support_naxa" ? "Équipe NAXA" : "Réponse pharmacie / support"}{message.interne ? " · Note interne" : ""}</strong><time className="text-xs text-slate-500">{new Date(message.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.contenu}</p>
            {message.piece_jointe_nom && <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs">{message.attachmentUrl ? <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-900 underline">Ouvrir la pièce jointe : {message.piece_jointe_nom}</a> : <span>Pièce jointe indisponible : {message.piece_jointe_nom}</span>}{message.piece_jointe_taille ? <span className="ml-2 text-slate-500">{Math.round(message.piece_jointe_taille / 1024)} Ko</span> : null}</div>}
          </article>)}
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>}
        {canReply ? <form onSubmit={send} className="space-y-3"><label className="block text-sm font-semibold">Répondre au ticket<textarea value={reply} onChange={(event) => setReply(event.target.value)} required maxLength={2000} rows={4} className="champ mt-1 rounded-xl py-3" placeholder="Écrire une réponse utile…" /></label>
          <button disabled={sending || threadLoading || !!threadError || !reply.trim()} className="min-h-11 rounded-xl bg-[#0B3D26] px-5 py-3 font-bold text-white disabled:opacity-50">{sending ? "Envoi…" : "Envoyer la réponse"}</button>
        </form> : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Ce ticket n’accepte plus de réponse dans son état actuel.</p>}
      </>}
    </section>
  </div>;
}
