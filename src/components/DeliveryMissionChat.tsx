"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type ChatMessage = {
  id:string;
  sender_id:string;
  sender_role:"client"|"livreur";
  body:string;
  created_at:string;
};
type ChatPayload = {
  available:boolean;
  can_send:boolean;
  messages:ChatMessage[];
  notice:string|null;
};

export function DeliveryMissionChat({
  reservationId,
  viewer,
}:{
  reservationId:string;
  viewer:"client"|"livreur";
}) {
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [draft,setDraft]=useState("");
  const [available,setAvailable]=useState(false);
  const [canSend,setCanSend]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const listRef=useRef<HTMLDivElement|null>(null);
  const lastMessageId=useRef<string|null>(null);

  const load=useCallback(async()=>{
    const {data,error:rpcError}=await supabaseBrowser().rpc("naxa_delivery_list_messages",{
      p_reservation:reservationId,
    });
    if(rpcError){
      setError("La conversation n’est pas accessible pour ce compte ou cette mission.");
      setLoading(false);
      return;
    }
    const payload=data as ChatPayload;
    setAvailable(payload?.available===true);
    setCanSend(payload?.can_send===true);
    setMessages(Array.isArray(payload?.messages)?payload.messages:[]);
    setNotice(payload?.notice||"");
    setError("");
    setLoading(false);
  },[reservationId]);

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),5000);
    return()=>window.clearInterval(timer);
  },[load]);

  useEffect(()=>{
    const latest=messages[messages.length-1];
    if(!latest||lastMessageId.current===latest.id)return;
    lastMessageId.current=latest.id;
    const node=listRef.current;
    if(node)node.scrollTop=node.scrollHeight;
  },[messages]);

  async function send(){
    const body=draft.trim();
    if(busy||!body||!canSend||body.length>1000)return;
    setBusy(true);setError("");
    const {error:rpcError}=await supabaseBrowser().rpc("naxa_delivery_send_message",{
      p_reservation:reservationId,
      p_body:body,
    });
    if(rpcError)setError(rpcError.message||"Message non envoyé. Réessayez.");
    else {setDraft("");await load();}
    setBusy(false);
  }

  return <section className="mt-4 rounded-xl border border-emerald-100 bg-white p-3">
    <div className="flex items-center justify-between gap-2">
      <div>
        <h4 className="font-extrabold text-slate-900">{viewer==="client"?"Écrire à votre Livreur":"Envoyer un message au Client"}</h4>
        <p className="mt-1 text-xs text-slate-500">Conversation privée liée à cette livraison · notifications à chaque nouveau message</p>
      </div>
      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900">NAXA</span>
    </div>

    {loading?<p className="mt-3 text-sm text-slate-500">Ouverture de la conversation…</p>
      :!available?<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{notice||"La discussion sera disponible dès qu’un Livreur aura accepté la commande."}</p>
      :<>
        <div ref={listRef} aria-live="polite" className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-2">
          {messages.length===0?<p className="p-3 text-center text-xs text-slate-500">Aucun message. Vous pouvez démarrer la conversation.</p>
            :messages.map(message=><div key={message.id} className={"flex "+(message.sender_role===viewer?"justify-end":"justify-start")}>
              <div className={"max-w-[88%] rounded-2xl px-3 py-2 "+(message.sender_role===viewer?"bg-[#0B3D26] text-white":"bg-white text-slate-900 shadow-sm")}>
                <p className="mb-1 text-[10px] font-bold opacity-75">{message.sender_role==="client"?"Client":"Livreur"}</p>
                <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                <time className="mt-1 block text-right text-[10px] opacity-70">{new Date(message.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</time>
              </div>
            </div>)}
        </div>

        {canSend?<div className="mt-3 space-y-2">
          <label className="block text-sm font-semibold" htmlFor={"delivery-chat-"+reservationId}>Votre message</label>
          <textarea id={"delivery-chat-"+reservationId} value={draft} onChange={event=>setDraft(event.target.value)} maxLength={1000} rows={2}
            onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void send();}}}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm" placeholder={viewer==="client"?"Écrivez à votre Livreur…":"Écrivez au Client…"}/>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500">{draft.length}/1000 · Entrée pour envoyer</p>
            <button type="button" disabled={busy||!draft.trim()} onClick={()=>void send()} className="min-h-10 rounded-lg bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?"Envoi…":"Envoyer"}</button>
          </div>
        </div>:<p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{notice||"La livraison est terminée. La conversation est conservée en lecture seule."}</p>}
      </>}
    {error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </section>;
}
