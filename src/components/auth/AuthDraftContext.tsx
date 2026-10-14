"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
type Drafts = Record<string, unknown>;
type DraftContextValue = { drafts: Drafts; hydrated: boolean; setDraft: (key: string, value: unknown) => void; clearSignupDrafts: () => void; };
const STORAGE_KEY = "naxa.signup-draft.v1";
const DRAFT_TTL_MS = 30 * 60 * 1000;
const DraftContext = createContext<DraftContextValue | null>(null);

export function AuthDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { savedAt?: number; drafts?: Drafts };
        const fresh = typeof saved.savedAt === "number" && Date.now() - saved.savedAt < DRAFT_TTL_MS;
        if (fresh && saved.drafts && typeof saved.drafts === "object") {
          setDrafts(Object.fromEntries(Object.entries(saved.drafts).filter(([key]) => key.startsWith("signup."))));
        } else window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Le stockage de session est facultatif.
    } finally { setHydrated(true); }
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const signupDrafts = Object.fromEntries(Object.entries(drafts).filter(([key]) => key.startsWith("signup.")));
    try {
      if (Object.keys(signupDrafts).length) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), drafts: signupDrafts }));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Le stockage indisponible ne bloque jamais l'inscription.
    }
  }, [drafts, hydrated]);
  const setDraft = useCallback((key: string, value: unknown) => setDrafts(previous => ({ ...previous, [key]: value })), []);
  const clearSignupDrafts = useCallback(() => setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith("signup.")))), []);
  return <DraftContext.Provider value={{ drafts, hydrated, setDraft, clearSignupDrafts }}>{children}</DraftContext.Provider>;
}
function useDraftContext() {
  const context = useContext(DraftContext);
  if (!context) throw new Error("Le contexte de formulaire d’authentification est indisponible.");
  return context;
}
export function useAuthDraftState<T>(key: string, initialValue: T): [T, (next: T | ((previous: T) => T)) => void] {
  const context = useDraftContext();
  const value = Object.prototype.hasOwnProperty.call(context.drafts, key) ? context.drafts[key] as T : initialValue;
  const setValue = useCallback((next: T | ((previous: T) => T)) => {
    const previous = Object.prototype.hasOwnProperty.call(context.drafts, key) ? context.drafts[key] as T : initialValue;
    context.setDraft(key, typeof next === "function" ? (next as (previous: T) => T)(previous) : next);
  }, [context, key, initialValue]);
  return [value, setValue];
}
export function useClearSignupDrafts() { return useDraftContext().clearSignupDrafts; }
export function useAuthDraftHydrated() { return useDraftContext().hydrated; }
