"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LienEspaceClient(){
 const [client,setClient]=useState(false);
 useEffect(()=>{(async()=>{const sb=supabaseBrowser();const {data:{user}}=await sb.auth.getUser();if(!user)return;const {data:p}=await sb.from("profiles").select("role").eq("id",user.id).single();setClient(p?.role==="client");})();},[]);
 return <Link href={client?"/client":"/connexion"} className="text-sm font-semibold text-naxa-canari underline underline-offset-4">{client?"Mon espace":"Se connecter"}</Link>;
}
