"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Ticket = {
  id: string;
  reference_code: string | null;
  sujet: string;
  categorie: string | null;
  statut: string;
  created_at: string;
  last_activity_at: string | null;
};

type IncomingCall = { id: string; ticket_id: string; status: string; created_at: string; ticket?: { id: string; reference_code: string | null; sujet: string; statut: string } };

type AgentSession = {
  agent: { first_name: string; last_name: string; presence: string };
  permissions: string[];
};

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Le service est indisponible.");
  return data as T;
}

export function SupportAgentWorkspace() {
  const router = useRouter();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [queue, setQueue] = useState<Ticket[]>([]);
  const [assigned, setAssigned] = useState<Ticket[]>([]);
  const [incomingCalls, setIncomingCalls] = useState<IncomingCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [presenceSaving, setPresenceSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const me = await readJson<AgentSession>("/api/support-agent/session");
      setSession(me);
      const results = await Promise.all([
        me.permissions.includes("queue_view")
          ? readJson<{ tickets: Ticket[] }>("/api/support-agent/queue")
          : Promise.resolve({ tickets: [] }),
        me.permissions.includes("ticket_view_assigned")
          ? readJson<{ tickets: Ticket[] }>("/api/support-agent/assigned")
          : Promise.resolve({ tickets: [] }),
        me.permissions.includes("audio_call")
          ? readJson<{ calls: IncomingCall[] }>("/api/support-agent/calls")
          : Promise.resolve({ calls: [] }),
      ]);
      setQueue(results[0].tickets);
      setAssigned(results[1].tickets);
      setIncomingCalls(results[2].calls);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le tableau de bord est indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 5000); return () => window.clearInterval(timer); }, [refresh]);

  async function togglePresence() {
    if (!session) return;
    setPresenceSaving(true);
    setError("");
    try {
      const presence = session.agent.presence === "available" ? "unavailable" : "available";
      const response = await fetch("/api/support-agent/presence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presence }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Modification de présence impossible.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Modification de présence impossible.");
    } finally {
      setPresenceSaving(false);
    }
  }

  async function claim(ticketId: string) {
    setClaiming(ticketId);
    setError("");
    try {
      const response = await fetch("/api/support-agent/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "La prise en charge a échoué.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La prise en charge a échoué.");
    } finally {
      setClaiming(null);
    }
  }

  async function transitionCall(call: IncomingCall, action: "accept" | "decline") {
    setClaiming(call.id);
    setError("");
    try {
      const response = await fetch("/api/support/calls/" + encodeURIComponent(call.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Transition d’appel refusée.");
      if (action === "accept") router.push("/equipe-support/dossiers/" + call.ticket_id + "?callId=" + call.id);
      else await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Transition d’appel refusée.");
      await refresh();
    } finally {
      setClaiming(null);
    }
  }

  const renderTicket = (ticket: Ticket, canClaim: boolean) => (
    <article key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold text-emerald-800">{ticket.reference_code || "Dossier support"}</p>
          <h3 className="mt-1 break-words font-bold">{ticket.sujet}</h3>
          <p className="mt-1 text-xs text-slate-500">{ticket.categorie || "Autre"} · {new Date(ticket.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}</p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">{ticket.statut}</span>
      </div>
      {canClaim && <button
        type="button"
        disabled={claiming !== null}
        onClick={() => void claim(ticket.id)}
        className="mt-4 min-h-10 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >{claiming === ticket.id ? "Prise en charge…" : "Prendre ce dossier"}</button>}
      {!canClaim && <a href={"/equipe-support/dossiers/" + ticket.id} className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-emerald-800 px-4 py-2 text-sm font-bold text-emerald-900">Ouvrir le dossier</a>}
    </article>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Espace interne NAXA</p>
          <h1 className="mt-1 text-2xl font-black">Tableau de bord support</h1>
          {session && <p className="mt-1 text-sm text-slate-600">Bonjour {session.agent.first_name}, votre présence est {session.agent.presence === "available" ? "disponible" : "indisponible"}.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {session && <button type="button" disabled={presenceSaving} onClick={() => void togglePresence()} className="rounded-xl border border-emerald-700 bg-white px-4 py-2 text-sm font-bold text-emerald-900 disabled:opacity-50">{presenceSaving ? "Mise à jour…" : session.agent.presence === "available" ? "Passer indisponible" : "Me rendre disponible"}</button>}
          <button type="button" onClick={() => void refresh()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Actualiser</button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading && <p role="status" className="text-sm text-slate-500">Chargement de votre espace…</p>}

      {!loading && <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Dossiers attribués</p><p className="mt-1 text-3xl font-black">{assigned.length}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Dossiers disponibles</p><p className="mt-1 text-3xl font-black">{queue.length}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Appels entrants</p><p className="mt-1 text-3xl font-black">{incomingCalls.length}</p></div>
      </div>}

      {!loading && session?.permissions.includes("audio_call") && session.permissions.includes("ticket_view_assigned") && <section className="space-y-3">
        <div><h2 className="text-lg font-extrabold">Appels audio entrants</h2><p className="text-sm text-slate-500">L’Agent affecté garde 20 secondes de priorité, puis l’appel rejoint la file centrale.</p></div>
        {incomingCalls.length ? incomingCalls.map((call) => <article key={call.id} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          <p className="font-mono text-xs font-bold text-emerald-800">{call.ticket?.reference_code || "Dossier support"}</p>
          <h3 className="mt-1 font-bold">{call.ticket?.sujet || "Demande d’appel audio"}</h3>
          <p className="mt-1 text-xs text-slate-500">Demande reçue le {new Date(call.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={claiming !== null || session.agent.presence !== "available"} onClick={() => void transitionCall(call, "accept")} className="min-h-10 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{claiming === call.id ? "Connexion…" : "Accepter l’appel"}</button>
            <button type="button" disabled={claiming !== null} onClick={() => void transitionCall(call, "decline")} className="min-h-10 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">Refuser l’appel</button>
          </div>
        </article>) : <p className="rounded-xl bg-white p-4 text-sm text-slate-500">Aucun appel audio en attente.</p>}
      </section>}

      {!loading && <section className="space-y-3">
        <div><h2 className="text-lg font-extrabold">Mes dossiers</h2><p className="text-sm text-slate-500">Dossiers exclusivement attribués à votre compte.</p></div>
        {assigned.length ? assigned.map((ticket) => renderTicket(ticket, false)) : <p className="rounded-xl bg-white p-4 text-sm text-slate-500">Aucun dossier ne vous est attribué.</p>}
      </section>}

      {!loading && session?.permissions.includes("queue_view") && <section className="space-y-3">
        <div><h2 className="text-lg font-extrabold">File centrale</h2><p className="text-sm text-slate-500">Seuls les dossiers non attribués sont proposés à la prise en charge.</p></div>
        {queue.length ? queue.map((ticket) => renderTicket(ticket, true)) : <p className="rounded-xl bg-white p-4 text-sm text-slate-500">Aucun dossier disponible dans la file.</p>}
      </section>}
    </div>
  );
}
