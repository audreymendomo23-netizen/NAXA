"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
type ThemeContextValue={night:boolean;toggle:()=>void;setNight:(value:boolean)=>void};
const ThemeContext=createContext<ThemeContextValue|null>(null);
const KEY="naxa-theme-night-v1";
export function ThemeProvider({children}:{children:ReactNode}){
 const [night,setNightState]=useState(false);
 const setNight=useCallback((value:boolean)=>{setNightState(value);try{localStorage.setItem(KEY,value?"night":"day")}catch{}},[]);
 const toggle=useCallback(()=>setNight(!night),[night,setNight]);
 useEffect(()=>{try{setNightState(document.documentElement.dataset.theme==="nuit"||localStorage.getItem(KEY)==="night")}catch{}},[]);
 useEffect(()=>{const root=document.documentElement;root.dataset.theme=night?"nuit":"jour";root.classList.toggle("naxa-dark",night);root.style.colorScheme=night?"dark":"light";const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",night?"#0B1210":"#064B2A")},[night]);
 const value=useMemo(()=>({night,toggle,setNight}),[night,toggle,setNight]);
 return <ThemeContext.Provider value={value}><div className="relative z-[2]">{children}</div></ThemeContext.Provider>;
}
export function useTheme(){const value=useContext(ThemeContext);if(!value)throw new Error("useTheme doit être utilisé dans ThemeProvider");return value}
