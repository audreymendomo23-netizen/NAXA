"use client";

import { useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function NativeSessionBridge(){
  const sb=useMemo(()=>supabaseBrowser(),[]);
  useEffect(()=>{
    const {data}=sb.auth.onAuthStateChange(event=>{
      if(event==="SIGNED_OUT"){
        (window as any).NaxaAndroid?.clearMeasurementReminders?.();
      }
    });
    return()=>data.subscription.unsubscribe();
  },[sb]);
  return null;
}
