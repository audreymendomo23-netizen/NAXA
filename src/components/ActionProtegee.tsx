"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = {
  children: ReactNode;
  href: string;
  className?: string;
  external?: boolean;
  onAutorise?: () => void | Promise<void>;
  "aria-hidden"?: boolean;
  tabIndex?: number;
  "aria-label"?: string;
};

export function ActionProtegee({ children, href, className = "", external = false, onAutorise, "aria-hidden": ariaHidden, tabIndex, "aria-label": ariaLabel }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<"connexion" | null>(null);
  const [busy, setBusy] = useState(false);
  const retour = () => window.location.pathname + window.location.search;

  async function continuer() {
    if (busy) return;
    setBusy(true);
    const sb = supabaseBrowser();
    const { data: auth } = await sb.auth.getUser();

    if (!auth.user) {
      setMessage("connexion");
      setBusy(false);
      return;
    }


    if (onAutorise) {
      await onAutorise();
    } else if (external) {
      window.location.assign(href);
    } else {
      router.push(href);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={continuer} disabled={busy || ariaHidden} aria-hidden={ariaHidden} tabIndex={tabIndex} aria-label={ariaLabel}>
        {children}
      </button>

      {message && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="acces-protege-titre">
          <div className="carte w-full max-w-sm space-y-4">
            <div>
              <h2 id="acces-protege-titre" className="text-xl font-extrabold">
                {message === "connexion" ? "Connectez-vous pour continuer" : ""}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                La recherche reste accessible sans compte. Pour utiliser cette action, veuillez vous connecter.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-vert w-full"
                onClick={() => router.push(
                  `/connexion?retour=${encodeURIComponent(retour())}`
                )}
              >
                Se connecter
              </button>
              <button type="button" className="btn btn-clair w-full" onClick={() => setMessage(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
