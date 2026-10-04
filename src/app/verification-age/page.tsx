"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

function Verification() {
  const router = useRouter();
  const params = useSearchParams();
  const retour = params.get("retour") || "/";
  const [date, setDate] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    setOccupe(true);
    setErreur("");

    const { error } = await supabaseBrowser().rpc("verify_age", { p_birth_date: date });
    setOccupe(false);

    if (error) {
      setErreur(
        error.message.includes("Âge minimum")
          ? "Vous devez avoir au moins 18 ans pour accéder à cette fonctionnalité."
          : "Impossible de vérifier votre âge. Vérifiez la date saisie et réessayez."
      );
      return;
    }

    router.replace(retour);
    router.refresh();
  }

  return (
    <form onSubmit={verifier} className="carte w-full max-w-sm space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">Vérification de l’âge</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Pour utiliser les fonctionnalités réservées aux utilisateurs connectés, indiquez votre date de naissance. NAXA conserve uniquement la confirmation que l’âge requis est vérifié.
        </p>
      </div>

      <label className="block text-sm font-semibold">
        Date de naissance
        <input
          className="champ mt-1"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
        />
      </label>

      <button className="btn btn-vert w-full" disabled={occupe}>
        {occupe ? "Vérification…" : "Vérifier mon âge"}
      </button>

      {erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}
    </form>
  );
}

export default function VerificationAge() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-naxa-green-900 px-5">
      <Logo />
      <Suspense fallback={<div className="text-white">Chargement…</div>}>
        <Verification />
      </Suspense>
    </main>
  );
}
