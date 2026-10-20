"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
export function DeconnexionGestionnaireStock(){
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const router=useRouter();
 async function signOut(){if(busy)return;setBusy(true);setError("");const {error:e}=await supabaseBrowser().auth.signOut();if(e){setError("Déconnexion impossible. Réessayez.");setBusy(false);return;}router.replace("/connexion");router.refresh();}
 return <div><button type="button" onClick={()=>void signOut()} disabled={busy} className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-red-700 hover:bg-red-50">{busy?"Déconnexion…":"↪ Déconnexion"}</button>{error&&<p role="alert" className="px-3 text-xs text-red-700">{error}</p>}</div>;
}
