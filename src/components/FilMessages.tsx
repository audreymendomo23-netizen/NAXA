"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Message = { id: string; expediteur: "client" | "pharmacie"; corps: string; created_at: string; lu_le: string | null };
export function FilMessages({ filId, role = "client" }: { filId: string; role?: "client" | "pharmacie" }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [corps, setCorps] = useState("");
  const [erreur, setErreur] = useState("");
  const charger = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data, error } = await sb.from("messages_pharmacie").select("id,expediteur,corps,created_at,lu_le").eq("fil_id", filId).order("created_at");
    if (error) setErreur("Conversation indisponible."); else setMessages((data ?? []) as Message[]);
  }, [filId]);
  useEffect(() => {
    void charger();
    const sb = supabaseBrowser();
    const ch = sb.channel(`fil-${filId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages_pharmacie", filter: `fil_id=eq.${filId}` }, () => { void charger(); }).subscribe();
    void sb.rpc("marquer_fil_lu", { p_fil: filId });
    return () => { void sb.removeChannel(ch); };
  }, [charger, filId]);
  async function envoyer() {
    if (!corps.trim()) return;
    const sb = supabaseBrowser(); const { error } = await sb.rpc("repondre_message", { p_fil: filId, p_corps: corps.trim() });
    if (error) setErreur("Le message n'a pas pu être envoyé."); else { setCorps(""); await charger(); }
  }
  return <section className="carte mt-4">
    <div className="max-h-80 space-y-3 overflow-y-auto">{messages.map(m => <div key={m.id} className={m.expediteur === role ? "flex justify-end" : "flex justify-start"}><div className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.expediteur === role ? "bg-naxa-canari" : "bg-slate-100"}`}><p className="whitespace-pre-wrap break-words text-sm">{m.corps}</p><time className="mt-1 block text-right text-[10px] text-slate-600">{new Date(m.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</time></div></div>)}</div>
    {erreur && <p role="alert" className="mt-2 text-sm text-red-700">{erreur}</p>}
    <div className="mt-3 flex gap-2"><input value={corps} maxLength={1000} onChange={e => setCorps(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void envoyer(); } }} className="champ min-w-0 flex-1" placeholder="Votre message…"/><button onClick={() => void envoyer()} disabled={!corps.trim()} className="btn btn-canari !px-4">Envoyer</button></div>
  </section>;
}
