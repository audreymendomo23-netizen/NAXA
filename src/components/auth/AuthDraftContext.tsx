"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
type Drafts = Record<string, unknown>;
type DraftContextValue = { drafts: Drafts; hydrated: boolean; setDraft: (key: string, value: unknown) => void; clearSignupDrafts: () => void; };
const DraftContext = createContext<DraftContextValue | null>(null);
export function AuthDraftProvider({ children }: { children: ReactNode }) {
 const [drafts, setDrafts] = useState<Drafts>({}); const [hydrated, setHydrated] = useState(false);
 useEffect(() => { setHydrated(true); }, []);
 const setDraft = useCallback((key: string, value: unknown) => setDrafts(previous => ({ ...previous, [key]: value })), []);
 const clearSignupDrafts = useCallback(() => setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith("signup.")))), []);
 return <DraftContext.Provider value={{ drafts, hydrated, setDraft, clearSignupDrafts }}>{children}</DraftContext.Provider>;
}
function useDraftContext() { const context = useContext(DraftContext); if (!context) throw new Error("Le contexte de formulaire d’authentification est indisponible."); return context; }
export function useAuthDraftState<T>(key: string, initialValue: T): [T, (next: T | ((previous: T) => T)) => void] { const context = useDraftContext(); const value = Object.prototype.hasOwnProperty.call(context.drafts, key) ? context.drafts[key] as T : initialValue; const setValue = useCallback((next: T | ((previous: T) => T)) => { const previous = Object.prototype.hasOwnProperty.call(context.drafts, key) ? context.drafts[key] as T : initialValue; context.setDraft(key, typeof next === "function" ? (next as (previous: T) => T)(previous) : next); }, [context, key, initialValue]); return [value, setValue]; }
export function useClearSignupDrafts() { return useDraftContext().clearSignupDrafts; }
export function useAuthDraftHydrated() { return useDraftContext().hydrated; }
