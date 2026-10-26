"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Message = { id: string | number; ticket_id: string; auteur_profile_id: string | null; contenu: string; interne: boolean; created_at: string };
type Ticket = { id: string; auteur_profile_id: string | null; pharmacie_id: string | null; sujet: string; type: string; statut: string; created_at: string };
export function AdminInbox({ tickets, messages }: { tickets: Ticket[]; messages: Message[] }) {
  const [selected, setSelected] = useState(tickets[0]?.id ?? "");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const current = tickets.find((ticket) => ticket.id === selected);
  const thread = messages.filter((message) => message.ticket_id === selected).sort((a,b) => a.created_at.localeCompare(b.created_at));

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current || !reply.trim()) return;
    setSending(true); setError(""); setSuccess("");
    try {
      const sb = supabaseBrowser();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { setError("La session administrateur a expiré."); return; }
      const response = await fetch("/api/admin/messagerie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: current.id, contenu: reply.trim() }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "La réponse n’a pas été envoyée. Réessayez."); return; }
      setReply("");
      setSuccess("Réponse envoyée.");
      router.refresh();
    } catch { setError("La messagerie est momentanément indisponible."); }
    finally { setSending(false); }
  }

  return <div className="grid gap-4 lg:grid-cols-[minmax(250px,.8fr)_minmax(0,1.4fr)]">
    <section className="carte space-y-3"><div><h2 className="text-lg font-extrabold">Requêtes reçues</h2><p className="text-sm text-slate-500">{tickets.length} ticket(s) récents</p></div>
      {!tickets.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune requête support n’est enregistrée.</p>}
      {tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => {setSelected(ticket.id);setError("");setSuccess("");}} className={`block w-full rounded-xl border p-3 text-left ${selected===ticket.id?"border-emerald-800 bg-emerald-50":"border-slate-200 bg-white"}`}>
        <span className="flex items-start justify-between gap-2"><strong className="break-words">{ticket.sujet}</strong><span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold">{ticket.statut}</span></span>
        <span className="mt-1 block text-xs text-slate-500">{ticket.type} · {new Date(ticket.created_at).toLocaleString("fr-FR")}</span>
        <span className="mt-1 block truncate font-mono text-[10px] text-slate-400">{ticket.id}</span>
      </button>)}
    </section>
    <section className="carte space-y-4">
      {!current ? <p className="text-sm text-slate-600">Sélectionnez une requête pour lire et traiter le fil.</p> : <>
        <header><div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Fil de support</p><h2 className="text-xl font-extrabold">{current.sujet}</h2><p className="text-xs text-slate-500">{current.type} · {current.statut} · {current.pharmacie_id ? "Pharmacie liée" : "Aucune pharmacie liée"}</p></div></header>
        <div className="max-h-[48vh] space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
          {!thread.length && <p className="text-sm text-slate-500">Aucun message dans ce ticket.</p>}
          {thread.map((message) => <article key={message.id} className="rounded-xl border bg-white p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="text-xs">{message.auteur_profile_id===current.auteur_profile_id?"Demandeur":"Équipe NAXA"}{message.interne?" · Note interne":""}</strong><time className="text-xs text-slate-500">{new Date(message.created_at).toLocaleString("fr-FR")}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.contenu}</p></article>)}
        </div>
        <form onSubmit={send} className="space-y-3"><label className="block text-sm font-semibold">Répondre au ticket<textarea value={reply} onChange={(event)=>setReply(event.target.value)} required maxLength={5000} rows={4} className="champ mt-1 rounded-xl py-3" placeholder="Écrire une réponse utile…"/></label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>}
          <button disabled={sending||!reply.trim()} className="min-h-11 rounded-xl bg-[#0B3D26] px-5 py-3 font-bold text-white disabled:opacity-50">{sending?"Envoi…":"Envoyer la réponse"}</button>
        </form>
      </>}
    </section>
  </div>;
}
