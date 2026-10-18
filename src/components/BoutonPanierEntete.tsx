"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePanier } from "@/lib/panier";
export function BoutonPanierEntete(){
 const {nombre,pret}=usePanier();const [arrival,setArrival]=useState(false);
 useEffect(()=>{const arrived=()=>{setArrival(true);window.setTimeout(()=>setArrival(false),900)};window.addEventListener("naxa:panier-ajoute",arrived);return()=>window.removeEventListener("naxa:panier-ajoute",arrived)},[]);
 return <Link href="/panier" aria-label={`Ouvrir le panier, ${nombre} article${nombre===1?"":"s"}`} title="Mon panier" className={`relative -mx-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#FFE33D] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFE33D] ${arrival?"naxa-cart-arrival":"naxa-cart-pulse"}`}>
 <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.1 11.2a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 1.9-1.5L22 8H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg>
 {pret&&nombre>0&&<span className="absolute right-0 top-0 flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#FFE33D] px-1 text-[10px] font-black leading-none text-[#064B2A]">{nombre>99?"99+":nombre}</span>}
 </Link>;
}
