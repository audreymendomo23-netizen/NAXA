"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type Drafts = Record<string, unknown>;
type AuthFlowValue = {
  drafts: Drafts;
  setDraft: (key: string, value: unknown) => void;
  direction: "forward" | "backward";
  setDirection: (direction: "forward" | "backward") => void;
  pharmacyName: string;
  setPharmacyName: (name: string) => void;
};
const AuthFlowContext = createContext<AuthFlowValue | null>(null);

export function AuthFlowProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [pharmacyName, setPharmacyName] = useState("");
  const setDraft = useCallback((key: string, value: unknown) => {
    setDrafts(previous => ({ ...previous, [key]: value }));
  }, []);
  useEffect(() => {
    const onPopState = () => setDirection("backward");
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || event.defaultPrevented || event.button !== 0) return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      const currentPath = window.location.pathname;
      const nextPath = next.pathname;
      const rank = (path: string, query: URLSearchParams) => {
        if (path === "/connexion" && query.get("espace") === "pharmacie") return query.get("etape") === "identifiants" ? 1 : 0;
        if (path === "/connexion") return 0;
        if (path === "/creation-compte" || path === "/mot-de-passe-oublie") return 1;
        if (path === "/nouveau-mot-de-passe") return 2;
        return -1;
      };
      setDirection(rank(nextPath, next.searchParams) >= rank(currentPath, new URLSearchParams(window.location.search)) ? "forward" : "backward");
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
  return <AuthFlowContext.Provider value={{ drafts, setDraft, direction, setDirection, pharmacyName, setPharmacyName }}>{children}</AuthFlowContext.Provider>;
}

export function useAuthFlow() {
  const value = useContext(AuthFlowContext);
  if (!value) throw new Error("useAuthFlow must be used inside AuthFlowProvider");
  return value;
}

export function useAuthDraftState<T>(key: string, initialValue: T): [T, (next: T | ((previous: T) => T)) => void] {
  const { drafts, setDraft } = useAuthFlow();
  const value = Object.prototype.hasOwnProperty.call(drafts, key) ? drafts[key] as T : initialValue;
  const setValue = useCallback((next: T | ((previous: T) => T)) => {
    const previous = Object.prototype.hasOwnProperty.call(drafts, key) ? drafts[key] as T : initialValue;
    setDraft(key, typeof next === "function" ? (next as (previous: T) => T)(previous) : next);
  }, [drafts, initialValue, key, setDraft]);
  return [value, setValue];
}
