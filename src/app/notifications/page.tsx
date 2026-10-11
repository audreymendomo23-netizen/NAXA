"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useNotifications } from "@/lib/messagerie";
import { FilMessages } from "@/components/FilMessages";
import { Logo } from "@/components/Logo";
import { BoutonNotifications } from "@/components/BoutonNotifications";

export default function NotificationsPage() {
  const { items, nonLus, loading, erreur } = useNotifications();
  const [fil, setFil] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => { setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission); }, []);
  async function activer() { if (typeof Notification !== "undefined") setPermission(await Notification.requestPermission()); }
  return <main className="mx-auto min-h-screen max-w-2xl px-4 pb-24">
    <header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3"><Link href="/"><Logo taille={32}/></Link><h1 className="font-bold text-white">Notifications</h1><BoutonNotifications/></header>
    <p className="mt-4 text-sm text-slate-600">{nonLus} non lue(s)</p>
    {permission === "default" && <button onClick={() => void activer()} className="btn btn-canari mt-3 w-full">Activer les alertes</button>}
    {permission === "denied" && <p className="mt-3 text-sm text-slate-600">Les alertes sont bloquées dans les paramètres du navigateur.</p>}
    {erreur && <p role="alert" className="mt-3 text-red-700">{erreur}</p>}
    {loading ? <p className="mt-6">Chargement…</p> : <ul className="mt-4 space-y-3">{items.map(n => <li key={n.id} className={`carte ${n.lu_le ? "" : "border-l-4 border-l-naxa-canari"}`}><p className="font-bold">{n.titre}</p><p className="mt-1 text-sm">{n.corps}</p><time className="mt-2 block text-xs text-slate-500">{new Date(n.created_at).toLocaleString("fr-FR")}</time>{n.fil_id && <button onClick={() => setFil(n.fil_id)} className="mt-2 text-sm font-bold underline">Lire et répondre</button>}</li>)}</ul>}
    {fil && <><div className="mt-5 flex items-center justify-between"><h2 className="font-bold">Conversation</h2><button onClick={() => setFil(null)} className="underline">Fermer</button></div><FilMessages filId={fil}/></>}
  </main>;
}
