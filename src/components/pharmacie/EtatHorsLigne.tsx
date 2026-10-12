"use client";
import { useCallback, useEffect, useState } from "react";
import { enregistrerOperation, listPendingOperations, pendingCount, removeOperation, markOperationAttempt, saveReference, unlockLocalDevice } from "@/lib/offline-db";

export function EtatHorsLigne() {
 const [online,setOnline]=useState(true),[count,setCount]=useState(0),[synced,setSynced]=useState(false);
 const refresh=useCallback(async()=>{setOnline(navigator.onLine);setCount(await pendingCount().catch(()=>0))},[]);
 const sync=useCallback(async()=>{
  if(!navigator.onLine)return;const devicePinSession=sessionStorage.getItem("naxa_offline_unlocked");
  if(!devicePinSession)return;
  try{
   const pin=atob(devicePinSession);const device=await unlockLocalDevice(pin);
   const ops=await listPendingOperations();
   for(const op of ops){
    try{const res=await fetch("/api/sync",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+device.token},body:JSON.stringify({operations:[op]})});if(!res.ok)throw new Error("sync failed");const data=await res.json();if(data.reference!==undefined)await saveReference(data.reference);await removeOperation(op.id)}
    catch{await markOperationAttempt(op.id,true);break}
   }
   setSynced(true);await refresh();
  }catch{ /* pas de PIN déverrouillé ou appareil expiré */ }
 },[refresh]);
 useEffect(()=>{void refresh();const on=()=>{void refresh();void sync()};window.addEventListener("online",on);window.addEventListener("offline",on);const timer=window.setInterval(()=>{if(navigator.onLine)void sync()},60_000);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",on);window.clearInterval(timer)}},[refresh,sync]);
 return <span aria-live="polite" className="inline-flex items-center gap-2 text-xs font-semibold"><span className={`inline-block h-2 w-2 rounded-full ${!online?"bg-gray-400":count?"bg-yellow-400":"bg-green-500"}`}/>{!online?"Hors ligne":count?`En attente d'envoi (${count})`:synced?"Synchronisé":"Connecté"}</span>;
}
export async function enregistrerNoteDeCaisse(note:string){return enregistrerOperation("note_caisse_test",{note:note.slice(0,500)})}
