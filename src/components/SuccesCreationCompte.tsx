"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmailBienvenue } from "@/components/EmailBienvenue";

export function SuccesCreationCompte({ destination }: { destination: string }) {
  const router = useRouter();
  const [emailStatus, setEmailStatus] = useState<"sending" | "sent" | "failed">("sending");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || emailStatus !== "sent") return;
    router.replace(destination);
    router.refresh();
  }, [ready, emailStatus, destination, router]);

  function continueNow() {
    router.replace(destination);
    router.refresh();
  }

  return (
    <section className="carte relative z-10 w-full max-w-lg overflow-hidden p-6 text-center sm:p-8" aria-labelledby="naxa-success-title">
      <div className="naxa-success-stage mx-auto flex h-28 w-28 items-center justify-center" aria-hidden="true">
        <span className="naxa-success-drop" />
        <svg viewBox="0 0 64 64" className="naxa-success-tick absolute h-16 w-16" fill="none">
          <path d="M14 33.5 26 45 50 19" stroke="#047D78" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="naxa-success-wave absolute h-24 w-24 rounded-full border-2 border-teal-400/70" />
      </div>
      <h1 id="naxa-success-title" className="naxa-success-copy mt-2 text-2xl font-extrabold text-naxa-green-900">Félicitations !</h1>
      <p className="naxa-success-copy mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600" style={{ animationDelay: "1.35s" }}>
        Votre compte NAXA a été créé avec succès.
      </p>
      <div className="naxa-success-copy" style={{ animationDelay: "1.65s" }}>
        <EmailBienvenue onStatus={setEmailStatus} />
      </div>
      <button type="button" onClick={continueNow} className="btn btn-canari mt-5 w-full">
        Continuer
        <span aria-hidden="true">→</span>
      </button>
      <p className="mt-3 text-xs text-slate-500">Vous allez être redirigé vers votre espace.</p>
    </section>
  );
}
