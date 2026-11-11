"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExamensDistanceButton(){
  const router=useRouter();
  const [state,setState]=useState<"idle"|"loading"|"ready"|"denied">("idle");
  const useLocation=()=>{
    if(!navigator.geolocation){setState("denied");return;}
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      position=>{
        const next=new URLSearchParams(window.location.search);
        next.set("lat",String(position.coords.latitude));
        next.set("lng",String(position.coords.longitude));
        next.set("tri","distance");
        setState("ready");
        router.push("/examens?"+next.toString());
      },
      ()=>setState("denied"),
      {enableHighAccuracy:false,timeout:10000,maximumAge:300000}
    );
  };
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={useLocation} disabled={state==="loading"} className="min-h-10 rounded-xl border border-violet-300 bg-white px-3 text-xs font-bold text-violet-900 disabled:opacity-60">
      {state==="loading"?"Localisation…":"Trier par distance (GPS)"}
    </button>
    {state==="denied"&&<span role="status" className="text-xs text-amber-800">Position refusée ou indisponible. Autorise la géolocalisation ou utilise le filtre ville.</span>}
    {state==="ready"&&<span role="status" className="text-xs text-emerald-800">Position utilisée pour ce tri uniquement.</span>}
  </div>;
}
