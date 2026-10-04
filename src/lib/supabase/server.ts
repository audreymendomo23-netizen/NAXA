import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export function supabaseServer(response?: NextResponse){
  const store=cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies:{
        getAll:()=>store.getAll(),
        setAll:(list: { name: string; value: string; options: CookieOptions }[])=>{
          try{
            list.forEach(({name,value,options})=>{
              if(response) response.cookies.set(name,value,options);
              else store.set(name,value,options);
            });
          }catch{}
        }
      }
    }
  )
}
export function supabaseAdmin(){
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {auth:{persistSession:false}}
  )
}
export function supabasePublic(revalidateSecondes=600){
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth:{persistSession:false},
      global:{
        fetch:(url,init)=>fetch(url,{...init,next:{revalidate:revalidateSecondes}})
      }
    }
  )
}
