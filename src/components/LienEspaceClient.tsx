"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LienEspaceClient(){
 const [client,setClient]=useState(false);
 useEffect(()=>{supabaseBrowser().auth.getUser().then(({data})=>setClient(data.user?.user_metadata?.role==="client"));},[]);
 return <Link href={client?"/client":"/connexion"} className="text-sm font-semibold text-naxa-canari underline underline-offset-4">{client?"Mon espace":"Se connecter"}</Link>;
}
