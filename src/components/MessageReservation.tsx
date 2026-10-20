"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

export function MessageReservation({ reservationId }: { reservationId: string }) {
 const [message,setMessage]=useState("");
 const [anonyme,setAnonyme]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 async function send(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(busy||!message.trim())return;
  setBusy(true);setError("");setNotice("");
  const {data,error:rpcError}=await supabaseBrowser().rpc("envoyer_message_reservation",{p_reservation:reservationId,p_corps:message.trim(),p_anonyme:anonyme});
  if(rpcError||!data){setError(rpcError?.message||"Le message n’a pas été envoyé. Réessayez.");}
  else {setMessage("");setNotice("Message envoyé à la pharmacie et lié à cette réservation.");}
  setBusy(false);
 }
 return <section className="carte space-y-3"><div><h2 className="font-extrabold">Écrire à la pharmacie</h2><p className="mt-1 text-sm text-slate-600">Votre message est transmis dans NAXA et rattaché à ce dossier. Aucun SMS ni WhatsApp automatique.</p></div>
 <form onSubmit={send} className="space-y-3"><label className="block text-sm font-bold" htmlFor="message-reservation">Votre message</label><textarea id="message-reservation" value={message} onChange={e=>setMessage(e.target.value)} maxLength={1000} required rows={3} className="w-full rounded-xl border border-slate-300 p-3" placeholder="Confirmer la disponibilité, demander une précision…"/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anonyme} onChange={e=>setAnonyme(e.target.checked)}/> Envoyer en tant que client anonyme</label><button disabled={busy||!message.trim()} className="btn btn-vert w-full" type="submit">{busy?"Envoi…":"Envoyer le message"}</button></form>
 {notice&&<p role="status" className="text-sm font-semibold text-emerald-800">{notice}</p>}{error&&<p role="alert" className="text-sm text-red-700">Envoi impossible. Vérifiez la connexion et que la réservation est encore active.</p>}
 <Link href="/client/messages" className="inline-block text-sm font-bold underline">Voir mes conversations</Link></section>;
}
