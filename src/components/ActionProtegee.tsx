"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = {
  children: ReactNode;
  href: string;
  className?: string;
  external?: boolean;
  onAutorise?: () => void | Promise<void>;
  "aria-hidden"?: boolean;
  tabIndex?: number;
};

export function ActionProtegee({ children, href, className = "", external = false, onAutorise, "aria-hidden": ariaHidden, tabIndex }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState<"connexion" | "age" | null>(null);
  const [busy, setBusy] = useState(false);

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

    const { data: profile } = await sb
      .from("profiles")
      .select("age_verified")
      .eq("id", auth.user.id)
      .maybeSingle();

    setBusy(false);

    if (!profile?.age_verified) {
      setMessage("age");
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
      <button type="button" className={className} onClick={continuer} disabled={busy} aria-hidden={ariaHidden} tabIndex={tabIndex}>
        {children}
      </button>

      {message && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="acces-protege-titre">
          <div className="carte w-full max-w-sm space-y-4">
            <div>
              <h2 id="acces-protege-titre" className="text-xl font-extrabold">
                {message === "connexion" ? "Connectez-vous pour continuer" : "Vérifiez votre âge pour continuer"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {message === "connexion"
                  ? "La recherche reste accessible sans compte. Pour utiliser cette action, veuillez vous connecter puis faire vérifier votre âge."
                  : "Cette fonctionnalité nécessite un compte connecté et une vérification de votre âge."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-vert w-full"
                onClick={() => router.push(
                  message === "connexion"
                    ? `/connexion?retour=${encodeURIComponent(pathname)}`
                    : `/verification-age?retour=${encodeURIComponent(pathname)}`
                )}
              >
                {message === "connexion" ? "Se connecter" : "Vérifier mon âge"}
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
