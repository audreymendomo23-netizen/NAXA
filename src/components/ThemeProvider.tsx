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
 useEffect(()=>{try{setNightState(localStorage.getItem(KEY)==="night")}catch{}},[]);
 useEffect(()=>{document.documentElement.classList.toggle("naxa-dark",night);document.documentElement.style.colorScheme=night?"dark":"light"},[night]);
 const value=useMemo(()=>({night,toggle,setNight}),[night,toggle,setNight]);
 return <ThemeContext.Provider value={value}>{night&&<div className="naxa-night-scene" aria-hidden="true"><span className="naxa-night-firefly"/><svg className="naxa-night-wave" viewBox="0 0 48 28" fill="none"><path d="M2 6c7 0 7 7 14 7S23 6 30 6s7 7 16 7M2 14c7 0 7 7 14 7s7-7 14-7 7 7 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg><svg className="naxa-night-wave" viewBox="0 0 48 28" fill="none"><path d="M2 6c7 0 7 7 14 7S23 6 30 6s7 7 16 7M2 14c7 0 7 7 14 7s7-7 14-7 7 7 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg><svg className="naxa-night-wave" viewBox="0 0 48 28" fill="none"><path d="M2 6c7 0 7 7 14 7S23 6 30 6s7 7 16 7M2 14c7 0 7 7 14 7s7-7 14-7 7 7 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></div>}<div className="relative z-[2]">{children}</div></ThemeContext.Provider>;
}
export function useTheme(){const value=useContext(ThemeContext);if(!value)throw new Error("useTheme doit être utilisé dans ThemeProvider");return value}
