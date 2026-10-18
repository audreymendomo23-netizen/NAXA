"use client";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
type Flight={id:number;nom:string;x:number;y:number;dx:number;dy:number};
export function AnimationPanierGlobale(){
 const [flight,setFlight]=useState<Flight|null>(null);
 useEffect(()=>{let seq=0;const onAdd=(event:Event)=>{const detail=(event as CustomEvent<{nom?:string;dosage?:string;origine?:{x:number;y:number}|null}>).detail;const x=detail?.origine?.x??Math.round(window.innerWidth*.5);const y=detail?.origine?.y??Math.round(window.innerHeight*.62);setFlight({id:++seq,nom:detail?.nom||"Article ajouté",x,y,dx:window.innerWidth-48-x,dy:38-y});window.setTimeout(()=>setFlight(current=>current?.id===seq?null:current),1050)};window.addEventListener("naxa:panier-ajoute",onAdd);return()=>window.removeEventListener("naxa:panier-ajoute",onAdd)},[]);
 if(!flight)return null;
 return <div key={flight.id} aria-hidden="true" className="naxa-cart-flight" style={{left:flight.x,top:flight.y,"--naxa-flight-x":`${flight.dx}px`,"--naxa-flight-y":`${flight.dy}px`} as CSSProperties}><svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 4h2l2 11h11l3-8H6"/></svg><span className="truncate">{flight.nom}</span></div>;
}
