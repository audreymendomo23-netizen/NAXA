"use client";
import { useEffect } from "react";
import type { ReactNode } from "react";
export function PanneauGlissant({ouvert,onFermer,titre,children}:{ouvert:boolean;onFermer:()=>void;titre:string;children:ReactNode}) {
 useEffect(()=>{if(!ouvert)return;const key=(e:KeyboardEvent)=>{if(e.key==="Escape")onFermer()};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[ouvert,onFermer]);
 if(!ouvert)return null;
 return <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation"><button aria-label="Fermer le panneau" className="absolute inset-0 bg-[#064B2A]/25" onClick={onFermer}/><section role="dialog" aria-modal="true" aria-label={titre} className="relative max-h-[90dvh] w-full max-w-xl animate-[naxa-sheet-in_300ms_ease-out] overflow-y-auto rounded-t-[24px] bg-white p-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-2xl"><div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#D8E9DE]"/><header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold text-[#064B2A]">{titre}</h2><button className="grid h-11 w-11 place-items-center rounded-full hover:bg-[#F2FAF5]" onClick={onFermer} aria-label="Fermer">×</button></header>{children}</section><style jsx>{`@keyframes naxa-sheet-in {from{transform:translateY(100%);opacity:.6}to{transform:translateY(0);opacity:1}}`}</style></div>;
}
