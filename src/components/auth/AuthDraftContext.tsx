"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
type Drafts = Record<string, unknown>;
type DraftContextValue = { drafts: Drafts; setDraft: (key:string,value:unknown)=>void };
const DraftContext = createContext<DraftContextValue | null>(null);
export function AuthDraftProvider({children}:{children:ReactNode}) {
 const [drafts,setDrafts] = useState<Drafts>({});
 const setDraft = useCallback((key:string,value:unknown)=>setDrafts(previous=>({...previous,[key]:value})),[]);
 return <DraftContext.Provider value={{drafts,setDraft}}>{children}</DraftContext.Provider>;
}
export function useAuthDraftState<T>(key:string,initialValue:T):[T,(next:T|((previous:T)=>T))=>void] {
 const context=useContext(DraftContext);
 if(!context) throw new Error("useAuthDraftState doit être utilisé dans AuthDraftProvider");
 const value=Object.prototype.hasOwnProperty.call(context.drafts,key)?context.drafts[key] as T:initialValue;
 const setValue=useCallback((next:T|((previous:T)=>T))=>{
  const previous=Object.prototype.hasOwnProperty.call(context.drafts,key)?context.drafts[key] as T:initialValue;
  context.setDraft(key,typeof next==="function"?(next as (previous:T)=>T)(previous):next);
 },[context,key,initialValue]);
 return [value,setValue];
}
