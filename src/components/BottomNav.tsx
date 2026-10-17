"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { usePanier } from "@/lib/panier";

type IconName = "home" | "heart" | "scan" | "shopping" | "calendar" | "clipboard" | "user";
function NavIcon({name,className="h-5 w-5"}:{name:IconName;className?:string}) {
 const common={fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true as const};
 return <svg viewBox="0 0 24 24" className={className} {...common}>
  {name==="home"&&<><path d="m3 10 9-7 9 7"/><path d="M5.5 9v11h13V9M9 20v-6h6v6"/></>}
  {name==="heart"&&<path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.8 2.5Z"/>}
  {name==="scan"&&<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/><path d="M8 9h8M8 15h8"/></>}
  {name==="shopping"&&<><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>}
  {name==="calendar"&&<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15l2.5 2.5L16 12"/></>}
  {name==="clipboard"&&<><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/></>}
  {name==="user"&&<><circle cx="12" cy="8" r="3.3"/><path d="M5 20c.5-3.4 2.9-5.2 7-5.2s6.5 1.8 7 5.2"/></>}
 </svg>;
}
export function BottomNav() {
 const pathname=usePathname();
 const searchParams=useSearchParams();
 const achatsTab=searchParams.get("onglet")==="achats";
 const {nombre}=usePanier();
 const [rotating,setRotating]=useState(0);
 const [reducedMotion,setReducedMotion]=useState(false);
 useEffect(()=>{const media=window.matchMedia("(prefers-reduced-motion: reduce)");const sync=()=>setReducedMotion(media.matches);sync();media.addEventListener("change",sync);return()=>media.removeEventListener("change",sync)},[]);
 useEffect(()=>{if(reducedMotion){setRotating(0);return}const id=window.setInterval(()=>setRotating(v=>(v+1)%3),3000);return()=>window.clearInterval(id)},[reducedMotion]);
 const scannerResults=pathname==="/scanner"&&searchParams.get("view")==="results";
 const visible=pathname==="/"||pathname==="/recherche"||(pathname==="/scanner"&&(scannerResults||searchParams.get("view")!=="results"&&searchParams.get("mode")!=="posologie"))||pathname==="/client/posologie"||pathname==="/resultats"||pathname==="/panier"||pathname==="/gardes"||pathname==="/client"||pathname.startsWith("/client/profil/")||pathname.startsWith("/produit/")||pathname.startsWith("/offre/")||pathname.startsWith("/reservation/");
 if(!visible||(pathname==="/scanner"&&!scannerResults))return null;
 const home=pathname==="/"||pathname==="/recherche"||pathname==="/resultats"||pathname==="/gardes"||pathname.startsWith("/produit/")||pathname.startsWith("/offre/");
 const scan=pathname==="/scanner";
 const favorites=pathname==="/client/profil/favoris";
 const profile=(pathname==="/client"&&!achatsTab)||pathname==="/client/posologie"||(pathname.startsWith("/client/profil/")&&!favorites)||pathname.startsWith("/reservation/");
 const shopping=(pathname==="/client"&&achatsTab)||pathname==="/panier";
 const labels=[{label:"Achats",icon:"shopping" as const},{label:"Réservations",icon:"calendar" as const},{label:"Commandes",icon:"clipboard" as const}];
 const purchase=labels[rotating];
 const tab=(active:boolean,label:string,icon:IconName,href:string,extra?:React.ReactNode,animated=false)=> <Link href={href} aria-current={active?"page":undefined} className="relative flex h-[54px] min-w-0 items-center justify-center rounded-[20px] transition-transform duration-150 active:scale-[0.96]">
  {active&&<span className="absolute inset-0 rounded-[20px] bg-[#0B3D26] transition-opacity duration-200"/>}
  <span className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 ${active?"text-white":"text-[#667D70]"}`}>
   <span key={animated?icon:"static-icon"} className={animated&&!reducedMotion?"animate-[naxa-nav-icon-bounce_420ms_ease-out]":""}><NavIcon name={icon} className={`h-5 w-5 ${active?"text-[#FFE23D]":""}`}/></span>
   <span className="relative h-3.5 max-w-full overflow-hidden text-[10px] font-semibold leading-none"><span key={animated?label:"static-label"} className={`block max-w-full truncate ${animated&&!reducedMotion?"animate-[naxa-nav-label-in_260ms_ease-out]":""}`}>{label}</span></span>
  </span>
  {active&&<span className="absolute top-1 h-1 w-1 rounded-full bg-[#FFE23D]"/>}{extra}
 </Link>;
 return <nav aria-label="Navigation principale" className="fixed inset-x-3 z-50 mx-auto h-16 max-w-[456px] rounded-[28px] border border-[#DCEAE0] bg-white/90 px-2 shadow-[0_-6px_22px_rgba(6,75,42,0.12)] backdrop-blur-xl" style={{bottom:"calc(env(safe-area-inset-bottom, 0px) + 10px)"}}>
  <div className="grid h-full grid-cols-5 items-center gap-0.5">
   {tab(home,"Accueil","home","/")}
   {tab(favorites,"Favoris","heart","/client/profil/favoris")}
   <Link href="/scanner" aria-current={scan?"page":undefined} className="relative flex h-[54px] min-w-0 flex-col items-center justify-end gap-1 pb-1 transition-transform active:scale-[0.96]">
    <span className="absolute -top-[23px] flex h-[58px] w-[58px] items-center justify-center rounded-full border-[4px] border-white bg-[#FFE23D] text-[#0B3D26] shadow-[0_5px_15px_rgba(11,61,38,0.18)] motion-safe:animate-[naxa-breathe_3s_ease-in-out_infinite]"><NavIcon name="scan" className="h-6 w-6"/></span>
    <span className={`text-[11px] font-bold leading-none ${scan?"text-[#0F6B3F]":"text-[#667D70]"}`}>Scanner</span>
   </Link>
   {tab(shopping,purchase.label,purchase.icon,"/client?onglet=achats",nombre>0&&<span className="absolute right-1 top-0 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#FFE23D] px-1 text-[10px] font-extrabold text-[#0B3D26]">{nombre>99?"99+":nombre}</span>,true)}
   {tab(profile,"Profil","user","/client")}
  </div>
 </nav>;
}
