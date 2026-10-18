"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { FilMessages } from "@/components/FilMessages";
import { Logo } from "@/components/Logo";
import { BoutonNotifications } from "@/components/BoutonNotifications";
type ThreadRow = { id: string; anonyme: boolean; client_archived_at: string | null; created_at: string; pharmacies: { nom: string; ville: string | null; quartier: string | null } | null; messages_pharmacie: { corps: string; created_at: string; expediteur: string }[] };
export default function MessagesClientPage() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) { window.location.assign("/connexion?retour=%2Fclient%2Fmessages"); return; }
    const { data, error: queryError } = await sb.from("fils_messages").select("id,anonyme,client_archived_at,created_at,pharmacies(nom,ville,quartier),messages_pharmacie(corps,created_at,expediteur)").eq("client_id", auth.user.id).order("created_at", { ascending: false });
    if (queryError) setError("Impossible de charger les conversations. Réessayez dans un instant.");
    else setThreads((data ?? []) as unknown as ThreadRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => threads.filter(thread => Boolean(thread.client_archived_at) === archived).filter(thread => {
    const pharmacy = thread.pharmacies?.nom ?? "Pharmacie";
    const last = [...(thread.messages_pharmacie ?? [])].sort((a,b) => b.created_at.localeCompare(a.created_at))[0]?.corps ?? "";
    return (pharmacy + " " + last).toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"));
  }).sort((a,b) => {
    const at = [...(a.messages_pharmacie ?? [])].sort((x,y) => y.created_at.localeCompare(x.created_at))[0]?.created_at ?? a.created_at;
    const bt = [...(b.messages_pharmacie ?? [])].sort((x,y) => y.created_at.localeCompare(x.created_at))[0]?.created_at ?? b.created_at;
    return bt.localeCompare(at);
  }), [threads, archived, query]);
  async function archive(id: string, value: boolean) {
    const { error: archiveError } = await supabaseBrowser().rpc("archiver_conversation_client", { p_fil: id, p_archiver: value });
    if (archiveError) { setError("Impossible de modifier l’archivage."); return; }
    await load(); setActive(null);
  }
  return <main className="mx-auto min-h-screen max-w-2xl px-4 pb-24">
    <header className="-mx-4 flex items-center justify-between gap-3 bg-naxa-green-900 px-4 py-3"><Link href="/"><Logo taille={32}/></Link><h1 className="font-bold text-white">Mes messages</h1><BoutonNotifications/></header>
    <p className="mt-4 text-sm text-slate-600">Vos conversations sont sauvegardées et classées par pharmacie.</p>
    <label className="mt-4 block"><span className="sr-only">Rechercher une conversation</span><input value={query} onChange={event => setQuery(event.target.value)} className="champ w-full" placeholder="Rechercher une pharmacie ou un message…"/></label>
    <div className="mt-3 flex gap-2"><button className={"rounded-full px-4 py-2 text-sm font-bold " + (!archived ? "bg-naxa-green-900 text-white" : "bg-slate-100")} onClick={() => setArchived(false)}>Conversations</button><button className={"rounded-full px-4 py-2 text-sm font-bold " + (archived ? "bg-naxa-green-900 text-white" : "bg-slate-100")} onClick={() => setArchived(true)}>Archivées</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {loading ? <p className="mt-6">Chargement des conversations…</p> : filtered.length === 0 ? <section className="carte mt-4"><p className="font-bold">{archived ? "Aucune conversation archivée." : "Aucune conversation pour le moment."}</p><p className="mt-1 text-sm text-slate-600">Les échanges avec une pharmacie apparaîtront ici et resteront accessibles après fermeture de l’application.</p><Link href="/" className="btn btn-vert mt-3 inline-flex">Rechercher une pharmacie</Link></section> : <ul className="mt-4 space-y-3">{filtered.map(thread => {
      const pharmacy = thread.pharmacies?.nom ?? "Pharmacie";
      const sorted = [...(thread.messages_pharmacie ?? [])].sort((a,b) => b.created_at.localeCompare(a.created_at));
      const last = sorted[0];
      return <li key={thread.id} className="carte"><button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setActive(active === thread.id ? null : thread.id)}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5F3E9] text-[#064B2A]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.1a9 9 0 0 1-.9-4.4A8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5Z"/></svg></span>
        <span className="min-w-0 flex-1"><strong className="block truncate">{pharmacy}</strong><span className="block truncate text-sm text-slate-600">{last?.corps ?? "Conversation créée"}</span><span className="text-xs text-slate-500">{last ? new Date(last.created_at).toLocaleString("fr-FR") : new Date(thread.created_at).toLocaleDateString("fr-FR")}</span></span><span className="text-slate-500">{active === thread.id ? "−" : "+"}</span></button>
        {active === thread.id && <><FilMessages filId={thread.id}/><button type="button" onClick={() => void archive(thread.id, !archived)} className="mt-3 text-sm font-semibold text-[#064B2A] underline">{archived ? "Restaurer dans les conversations" : "Archiver cette conversation"}</button></>}
      </li>;
    })}</ul>}
  </main>;
}
