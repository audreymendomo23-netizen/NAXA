"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

function decoderCle(value:string){
  const base64=value.replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64.padEnd(Math.ceil(base64.length/4)*4,"="));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}

export function ActiverPushNaxa(){
  const [state,setState]=useState<"idle"|"working"|"ready"|"error"|"unsupported">("idle");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    const native=(window as any).NaxaAndroid;
    if(native?.isAvailable?.()){
      const registerToken=async(token:string)=>{
        try{
          const sb=supabaseBrowser();
          const {data}=await sb.auth.getSession();
          if(!data.session?.access_token)return;
          const response=await fetch("/api/notifications/fcm/register",{
            method:"POST",
            headers:{"Content-Type":"application/json","Authorization":`Bearer ${data.session.access_token}`},
            body:JSON.stringify({token})
          });
          if(!response.ok)throw new Error("Enregistrement des notifications distantes indisponible.");
          setState("ready");setMessage("Notifications locales Android et notifications distantes NAXA activées sur ce téléphone.");
        }catch(e){
          setMessage(e instanceof Error?e.message:"Notifications distantes non enregistrées.");
        }
      };
      const receiveToken=(event:Event)=>{
        const token=String((event as CustomEvent).detail?.token??"");
        if(token.length>=100)void registerToken(token);
      };
      const receive=(event:Event)=>{
        const detail=(event as CustomEvent).detail??{};
        if(detail.type==="notificationPermissionGranted"){
          setState("ready");setMessage("Notifications locales activées. Activation du canal distant NAXA…");
          native.refreshFcmToken?.();
        }else if(detail.type==="error"&&String(detail.message??"").toLowerCase().includes("notification")){
          setState("error");setMessage(String(detail.message));
        }
      };
      window.addEventListener("naxa-fcm-token",receiveToken);
      window.addEventListener("naxa-android-ble",receive);
      if(native.hasNotificationPermission?.()===true){
        const saved=String(native.getFcmToken?.()??"");
        if(saved.length>=100)void registerToken(saved);
        native.refreshFcmToken?.();
      }
      if(native.areLocalRemindersEnabled?.()===true&&native.hasNotificationPermission?.()===true){
        setState("ready");setMessage("Notifications locales Android activées. Vérification du canal distant NAXA…");
      }
      return()=>{
        window.removeEventListener("naxa-fcm-token",receiveToken);
        window.removeEventListener("naxa-android-ble",receive);
      };
    }
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){
      setState("unsupported");return;
    }
    if(Notification.permission==="denied")setState("error");
  },[]);

  async function activer(){
    setState("working");setMessage("");
    const native=(window as any).NaxaAndroid;
    if(native?.isAvailable?.()){
      native.requestNotifications?.();
      native.refreshFcmToken?.();
      if(native.areLocalRemindersEnabled?.()===true&&native.hasNotificationPermission?.()===true){
        setState("ready");setMessage("Notifications locales Android activées. Les rappels et alertes peuvent apparaître sur ce téléphone.");
      }else{
        setState("idle");setMessage("Autorisation Android demandée. Acceptez-la pour activer les notifications locales.");
      }
      return;
    }
    try{
      if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))
        throw new Error("Notifications non prises en charge.");
      let permission=Notification.permission;
      if(permission!=="granted")permission=await Notification.requestPermission();
      if(permission!=="granted")throw new Error("Autorisez les notifications dans les réglages du navigateur.");
      const sb=supabaseBrowser();
      const {data:auth,error:authError}=await sb.auth.getUser();
      if(authError||!auth.user)throw new Error("Connectez-vous pour activer les notifications.");
      const response=await fetch("/api/posologie/push-key",{cache:"no-store"});
      if(!response.ok)throw new Error("Les notifications serveur ne sont pas encore configurées.");
      const {publicKey}=await response.json() as {publicKey:string};
      const registration=await navigator.serviceWorker.register("/naxa-push-sw.js",{scope:"/naxa-push/"});
      const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({
        userVisibleOnly:true,applicationServerKey:decoderCle(publicKey)
      });
      const {error}=await sb.from("naxa_push_subscriptions").upsert({
        endpoint:subscription.endpoint,user_id:auth.user.id,subscription:subscription.toJSON(),
        updated_at:new Date().toISOString()
      },{onConflict:"endpoint"});
      if(error)throw error;
      setState("ready");
      setMessage("Les notifications NAXA (rappels, messages et alertes) pourront apparaître sur ce téléphone.");
    }catch(e){
      setState("error");setMessage(e instanceof Error?e.message:"Activation impossible.");
    }
  }

  if(state==="unsupported")return <p className="text-sm text-slate-600">Les notifications hors application ne sont pas prises en charge sur ce navigateur.</p>;
  return <div className="carte mt-4 space-y-2">
    <button type="button" onClick={()=>void activer()} disabled={state==="working"||state==="ready"} className="btn btn-canari w-full">
      {state==="working"?"Activation…":state==="ready"?"Notifications sur ce téléphone activées":state==="error"?"Réessayer les notifications":"Activer les notifications sur ce téléphone"}
    </button>
    {message&&<p role={state==="error"?"alert":"status"} className="text-xs text-slate-600">{message}</p>}
  </div>;
}
