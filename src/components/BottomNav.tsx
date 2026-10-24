"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { usePanier } from "@/lib/panier";
import { supabaseBrowser } from "@/lib/supabase/client";
import { isProfileVerified } from "@/lib/client-profile";

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
 const router=useRouter();
 const searchParams=useSearchParams();
 const {nombre}=usePanier();
 const [avatarUrl,setAvatarUrl]=useState<string|null>(null);
 const [profileVerified,setProfileVerified]=useState(false);
 const [initiales,setInitiales]=useState("C");
 const [rotating,setRotating]=useState(0);
 const [reducedMotion,setReducedMotion]=useState(false);
 useEffect(()=>{
  let actif=true;
  const sb=supabaseBrowser();
  type UtilisateurProfil={id:string;user_metadata?:Record<string,unknown>;email?:string|null;phone?:string|null};
  const chargerProfil=async(utilisateurForce?:UtilisateurProfil|null)=>{
   const utilisateur=utilisateurForce===undefined?(await sb.auth.getUser()).data.user:utilisateurForce;
   if(!actif)return;
   if(!utilisateur){setAvatarUrl(null);setInitiales("C");setProfileVerified(false);return;}
   const [{data:profile},{data:prefs}]=await Promise.all([sb.from("profiles").select("first_name,last_name,avatar_url").eq("id",utilisateur.id).maybeSingle(),sb.from("client_preferences").select("adresse_defaut").eq("user_id",utilisateur.id).maybeSingle()]);
   if(!actif)return;
   const meta=utilisateur.user_metadata??{};
   const prenom=typeof profile?.first_name==="string"&&profile.first_name.trim()?profile.first_name.trim():typeof meta.first_name==="string"?meta.first_name.trim():typeof meta.given_name==="string"?meta.given_name.trim():"";
   const nom=typeof profile?.last_name==="string"&&profile.last_name.trim()?profile.last_name.trim():typeof meta.last_name==="string"?meta.last_name.trim():typeof meta.family_name==="string"?meta.family_name.trim():"";
   const nomComplet=[prenom,nom].filter(Boolean).join(" ").trim()||String(meta.full_name??meta.name??utilisateur.email?.split("@")[0]??"Client");
   const lettres=nomComplet.split(/[\s._-]+/).filter(Boolean).slice(0,2).map((part:string)=>Array.from(part)[0]?.toLocaleUpperCase("fr-FR")??"").join("");
   setInitiales(lettres||"C");
   let photo: string | null = typeof profile?.avatar_url === "string" ? profile.avatar_url : typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : typeof meta.photo_url === "string" ? meta.photo_url : null;
   try {
    const localPhoto = window.localStorage.getItem(`naxa-client-profile-photo-v1:${utilisateur.id}`);
    if (localPhoto) photo = localPhoto;
   } catch {}

   let address=typeof prefs?.adresse_defaut==="string"?prefs.adresse_defaut:"";
   try {
    const savedAddresses: unknown=JSON.parse(window.localStorage.getItem("naxa-client-addresses-v1")||"[]");
    if(Array.isArray(savedAddresses)){
     const primary=savedAddresses.find((item)=>item&&typeof item==="object"&&"isDefault" in item&&item.isDefault===true);
     if(primary&&typeof primary==="object"){
      const value=primary as {street?:unknown;neighborhood?:unknown;city?:unknown};
      address=[value.street,value.neighborhood,value.city].filter((part):part is string=>typeof part==="string"&&Boolean(part.trim())).join(", ")||address;
     }
    }
   } catch {}
   const phone=String(utilisateur.phone??meta.phone??"");
   setAvatarUrl(typeof photo==="string"&&photo?photo:null);
   setProfileVerified(isProfileVerified({address,phone,photo}));
  };
  void chargerProfil();
  const {data:{subscription}}=sb.auth.onAuthStateChange((_event,session)=>{void chargerProfil(session?.user??null)});
  const refreshProfile=()=>{void chargerProfil()};
  const refreshStorage=(event:StorageEvent)=>{if(!event.key||event.key.startsWith("naxa-client-profile-photo-v1:")||event.key==="naxa-client-addresses-v1")refreshProfile()};
  window.addEventListener("naxa-profile-updated",refreshProfile);
  window.addEventListener("naxa-addresses-updated",refreshProfile);
  window.addEventListener("storage",refreshStorage);
  return()=>{actif=false;subscription.unsubscribe();window.removeEventListener("naxa-profile-updated",refreshProfile);window.removeEventListener("naxa-addresses-updated",refreshProfile);window.removeEventListener("storage",refreshStorage)};
 },[]);
 useEffect(()=>{const media=window.matchMedia("(prefers-reduced-motion: reduce)");const sync=()=>setReducedMotion(media.matches);sync();media.addEventListener("change",sync);return()=>media.removeEventListener("change",sync)},[]);
 useEffect(()=>{if(reducedMotion){setRotating(0);return}const id=window.setInterval(()=>setRotating(v=>(v+1)%3),3000);return()=>window.clearInterval(id)},[reducedMotion]);
 useEffect(()=>{
  let startX=0,startY=0;
  let eligible=false;
  const onStart=(event:TouchEvent)=>{
   if(event.touches.length!==1){eligible=false;return;}
   const target=event.target;
   if(!(target instanceof Element)||target.closest('nav[aria-label="Navigation principale"],input,textarea,select,[contenteditable="true"],video,canvas,.naxa-carousel-viewport,[data-no-tab-swipe]')){eligible=false;return;}
   startX=event.touches[0].clientX;
   startY=event.touches[0].clientY;
   eligible=true;
  };
  const onMove=(event:TouchEvent)=>{
   if(!eligible||event.touches.length!==1)return;
   const dx=event.touches[0].clientX-startX;
   const dy=event.touches[0].clientY-startY;
   if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.25)event.preventDefault();
  };
  const onEnd=(event:TouchEvent)=>{
   if(!eligible||event.changedTouches.length!==1){eligible=false;return;}
   eligible=false;
   const dx=event.changedTouches[0].clientX-startX;
   const dy=event.changedTouches[0].clientY-startY;
   if(Math.abs(dx)<80||Math.abs(dx)<Math.abs(dy)*1.3)return;
   const tabs=[{id:"home",href:"/client"},{id:"favorites",href:"/client/profil/favoris"},{id:"scanner",href:"/scanner"},{id:"shopping",href:"/client?onglet=achats"},{id:"profile",href:"/client/profil"}];
   const active=pathname==="/client"||pathname==="/"||pathname==="/recherche"||pathname==="/resultats"||pathname==="/gardes"||pathname.startsWith("/produit/")||pathname.startsWith("/offre/")?"home":pathname==="/client/profil/favoris"?"favorites":pathname==="/scanner"?"scanner":pathname==="/client"||pathname==="/panier"?"shopping":pathname==="/client/posologie"||pathname.startsWith("/client/profil/")||pathname.startsWith("/reservation/")?"profile":null;
   if(!active)return;
   const index=tabs.findIndex(tab=>tab.id===active);
   const next=index+(dx<0?1:-1);
   if(next>=0&&next<tabs.length)router.push(tabs[next].href);
  };
  document.addEventListener("touchstart",onStart,{passive:true});
  document.addEventListener("touchmove",onMove,{passive:false});
  document.addEventListener("touchend",onEnd,{passive:true});
  return()=>{document.removeEventListener("touchstart",onStart);document.removeEventListener("touchmove",onMove);document.removeEventListener("touchend",onEnd)};
 },[pathname,searchParams,router]);
 const scannerResults=pathname==="/scanner"&&searchParams.get("view")==="results";
 const home=pathname==="/client"||pathname==="/"||pathname==="/recherche"||pathname==="/resultats"||pathname==="/gardes"||pathname.startsWith("/produit/")||pathname.startsWith("/offre/");
 // La barre principale est réservée à l'accueil client : ne pas l'afficher sur l'accueil public.
 const visible=pathname==="/client";
 const scan=pathname==="/scanner";
 const favorites=pathname==="/client/profil/favoris";
 const profile=pathname==="/client/posologie"||(pathname==="/client/profil"||pathname.startsWith("/client/profil/"))&&!favorites||pathname.startsWith("/reservation/");
 const shopping=pathname==="/client"||pathname==="/panier";
 const labels=[{label:"Achats",icon:"shopping" as const},{label:"Réservations",icon:"calendar" as const},{label:"Commandes",icon:"clipboard" as const}];
 const purchase=labels[rotating];
 const tab=(active:boolean,label:string,icon:IconName,href:string,extra?:React.ReactNode,animated=false)=> <Link href={href} aria-current={active?"page":undefined} className="relative flex h-[54px] min-w-0 items-center justify-center rounded-[20px] transition-transform duration-150 active:scale-[0.96]">
  {active&&<span className="absolute inset-0 rounded-[20px] bg-[#0B3D26] transition-opacity duration-200"/>}
  <span className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 ${active?"text-white":"text-[#667D70]"}`}>
   {label==="Profil" ? <span className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border text-[12px] font-extrabold shadow-sm ${active?"border-[#FFE23D] bg-[#FFE23D] text-[#0B3D26]":"border-[#B8CDBF] bg-[#E7F1EA] text-[#0B3D26]"}`} aria-label="Photo de profil">{avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover"/> : initiales}{profileVerified&&<span className="absolute bottom-0 right-0 flex h-3 w-3 items-center justify-center rounded-full bg-[#1D9BF0] text-white"><svg viewBox="0 0 24 24" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg></span>}</span> : <span key={animated?icon:"static-icon"} className={animated&&!reducedMotion?"animate-[naxa-nav-icon-bounce_420ms_ease-out]":""}><NavIcon name={icon} className={`h-5 w-5 ${active?"text-[#FFE23D]":""}`}/></span>}
   <span className="relative h-3.5 max-w-full overflow-hidden text-[10px] font-semibold leading-none"><span key={animated?label:"static-label"} className={`block max-w-full truncate ${animated&&!reducedMotion?"animate-[naxa-nav-label-in_260ms_ease-out]":""}`}>{label}</span></span>
  </span>
  {active&&<span className="absolute top-1 h-1 w-1 rounded-full bg-[#FFE23D]"/>}{extra}
 </Link>;
 if(!visible)return null;
 return <nav aria-label="Navigation principale" className="fixed inset-x-3 z-50 mx-auto h-16 max-w-[456px] rounded-[28px] border border-[#DCEAE0] bg-white/90 px-2 shadow-[0_-6px_22px_rgba(6,75,42,0.12)] backdrop-blur-xl" style={{bottom:"calc(env(safe-area-inset-bottom, 0px) + 10px)"}}>
  <div className="grid h-full grid-cols-5 items-center gap-0.5">
   {tab(home,"Accueil","home","/client")}
   {tab(favorites,"Favoris","heart","/client/profil/favoris")}
   <Link href="/scanner" aria-current={scan?"page":undefined} className="relative flex h-[54px] min-w-0 flex-col items-center justify-end gap-1 pb-1 transition-transform active:scale-[0.96]">
    <span className="absolute -top-[23px] flex h-[58px] w-[58px] items-center justify-center rounded-full border-[4px] border-white bg-[#FFE23D] text-[#0B3D26] shadow-[0_5px_15px_rgba(11,61,38,0.18)] motion-safe:animate-[naxa-breathe_3s_ease-in-out_infinite]"><NavIcon name="scan" className="h-6 w-6"/></span>
    <span className={`text-[11px] font-bold leading-none ${scan?"text-[#0F6B3F]":"text-[#667D70]"}`}>Scanner</span>
   </Link>
   {tab(shopping,purchase.label,purchase.icon,"/client?onglet=achats",nombre>0&&<span className="absolute right-1 top-0 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#FFE23D] px-1 text-[10px] font-extrabold text-[#0B3D26]">{nombre>99?"99+":nombre}</span>,true)}
   {tab(profile,"Profil","user","/client/profil",undefined,false)}
  </div>
 </nav>;
}
